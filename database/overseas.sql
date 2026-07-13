--
-- PostgreSQL database dump
--

\restrict FS3jMbHdEXJ30TM9WOO2glozu5yS0myiG6VcpfJA4ScVYBnYawodB4f8rVIFZky

-- Dumped from database version 17.10
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: check_application_data(); Type: FUNCTION; Schema: public; Owner: myuser
--

CREATE FUNCTION public.check_application_data() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- valid referent, institution is checked by existing constraint
    IF NEW.referent_id IS NOT NULL AND NOT EXISTS(
        SELECT 1
        FROM users
        WHERE id = NEW.referent_id
        AND role='referent'
    ) THEN
        RAISE EXCEPTION 'application referent must have role=referent';
    END IF;

    -- valid student, institution is checked by existing constraint
    IF NOT EXISTS(
        SELECT 1
        FROM users
        WHERE id=NEW.user_id
        AND role='student'
    ) THEN
        RAISE EXCEPTION 'application student must have role=student';
    END IF;

    IF NEW.status IN ('mobility_ongoing','pre_departure_completed','exam_recognition','closed') THEN
        -- restrict institution changes
        IF (NEW.sending_institution <> OLD.sending_institution OR NEW.host_institution <> OLD.host_institution) THEN
            RAISE EXCEPTION 'cannot change institutions while application is in % status', NEW.status;
        END IF;
        -- restrict referent changes
        IF (NEW.referent_id IS DISTINCT FROM OLD.referent_id) THEN
            RAISE EXCEPTION 'cannot change referent while application is in % status', NEW.status;
        END IF;
    END IF;

    -- check if student cannot create a application that is already past all the LA & exams validation process
    IF TG_OP='INSERT' AND NEW.status NOT IN('created','learning_agreement_pending') THEN
        RAISE EXCEPTION 'application status cannot start with %', NEW.status;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_application_data() OWNER TO myuser;

--
-- Name: check_application_status_workflow(); Type: FUNCTION; Schema: public; Owner: myuser
--

CREATE FUNCTION public.check_application_status_workflow() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
	-- the status learning_agreement_pending must only be updated when status is created or la_pending
	if NEW.status='learning_agreement_pending' AND OLD.status NOT IN ('learning_agreement_pending', 'created') THEN
		RAISE EXCEPTION 'application status cannot pass from % -> %', OLD.status, NEW.status;
	END IF;


	-- the status must go to 'created' only if the previous status was la_pending or created
	IF NEW.status='created' AND OLD.status NOT IN ('learning_agreement_pending', 'created') THEN
		RAISE EXCEPTION 'cannot move to created without an approved learning agreement';
	END IF;
	
	-- the status 'created' must be blocked from going anywhere else
	IF OLD.status='closed' AND NEW.status<>'closed' THEN
		RAISE EXCEPTION 'status is closed, no actions are possible';
	END IF;

	-- learning_agreement_pending -> pre_departure_completed
	IF NEW.status='pre_departure_completed' AND OLD.status='created' THEN
		-- check if associated learning agreement exists and has been approved
		IF NOT EXISTS ( SELECT 1 
				FROM uploaded_documents
				WHERE application_id=NEW.id 
				AND document_type='learning_agreement'
				AND status='approved'
			) THEN
			RAISE EXCEPTION 'cannot move to pre_departure_completed without an approved learning agreement';
		END IF;

		-- check if mapped exams exists and are all approved (search for at least 1 that has not been approved)
		IF EXISTS (SELECT 1
			FROM mapped_exams
			WHERE application_id=NEW.id
			AND status<>'approved'
			) THEN
			RAISE EXCEPTION 'cannot move to pre_departure_completed: all mapped exams must be approved';
		END IF;

		-- check if there is another application in the same time period
		IF EXISTS (SELECT 1
			FROM applications
			WHERE user_id = NEW.user_id
			AND id <> NEW.id
			AND status NOT IN ('learning_agreement_pending','created')
			AND (date_arrived, date_departure) OVERLAPS (NEW.date_arrived, NEW.date_departure)
			) THEN
			RAISE EXCEPTION 'this application overlaps with another applicaiton in the same time period';
		END IF;
	ELSEIF NEW.status='pre_departure_completed' AND OLD.status<>'created' THEN
		RAISE EXCEPTION 'application status cannot pass from % -> %', OLD.status, NEW.status;
	END IF;

	-- pre_departure_completed -> mobility_ongoing
	IF NEW.status='mobility_ongoing' AND OLD.status='pre_departure_completed' THEN
		-- when going to mobility_ongoing user can only update the date_arrived field
		IF NEW.date_departure IS DISTINCT FROM OLD.date_departure THEN
			RAISE EXCEPTION 'you can only update the arrival date, not the departure date';
		END IF;

		-- user can update the new date_arrived check if new updated date is overlapping
		IF EXISTS (SELECT 1
			FROM applications
			WHERE user_id = NEW.user_id
			AND id <> NEW.id
			AND status NOT IN ('learning_agreement_pending','created')
			AND (date_arrived, date_departure) OVERLAPS (NEW.date_arrived, NEW.date_departure)
			) THEN
			RAISE EXCEPTION 'this application overlaps with another applicaiton in the same time period';
		END IF;
	ELSEIF NEW.status='mobility_ongoing' AND OLD.status<>'pre_departure_completed' THEN
		RAISE EXCEPTION 'application status cannot pass from % -> %', OLD.status, NEW.status;
	END IF;
	
	-- mobility_ongoing -> exam_recognition
	IF NEW.status='exam_recognition' AND OLD.status='mobility_ongoing' THEN
		-- when going to exam_recognition user can only update the date_departure field
		IF NEW.date_arrived IS DISTINCT FROM OLD.date_arrived THEN
			RAISE EXCEPTION 'you can only update the departure date, not the arrival date';
		END IF;
		IF NEW.date_arrived IS NULL OR NEW.date_departure IS NULL THEN
			RAISE EXCEPTION 'date arrived or date departure cannot be null';
		END IF;
		IF EXISTS (SELECT 1
			FROM la_modifications
			WHERE application_id=NEW.id
			AND status='pending'
			) THEN
			RAISE EXCEPTION 'cannot change application status to exam_recognition when there are pending modifications';
		END IF;
		-- user can update the new date_departure check if new updated date is overlapping
		IF EXISTS (SELECT 1
			FROM applications
			WHERE user_id = NEW.user_id
			AND id <> NEW.id
			AND status NOT IN ('learning_agreement_pending','created')
			AND (date_arrived, date_departure) OVERLAPS (NEW.date_arrived, NEW.date_departure)
			) THEN
			RAISE EXCEPTION 'this application overlaps with another applicaiton in the same time period';
		END IF;

		-- update the mapped exams to 'pending' because a grade is expected
		UPDATE mapped_exams 
		SET status='pending' 
		WHERE application_id=NEW.id;
	ELSEIF NEW.status='exam_recognition' AND OLD.status<>'mobility_ongoing' THEN
		RAISE EXCEPTION 'application status cannot pass from % -> %', OLD.status, NEW.status;
	END IF;

	IF NEW.status='closed' AND OLD.status='exam_recognition' THEN
		-- check uploaded transcript of records, if it exists and has been approved
		IF NOT EXISTS (SELECT 1
			FROM uploaded_documents
			WHERE application_id=NEW.id
			AND document_type='transcript'
			AND status='approved'
			) THEN
			RAISE EXCEPTION 'approved transcript of records required';
		END IF;

		-- check if all mapped_exams are graded (if exists at least 1 that has no grade)
		IF EXISTS(SELECT 1
				FROM mapped_exams
				WHERE application_id=NEW.id AND 
				(grade IS NULL OR grade=-1 OR status <> 'approved')
			) THEN
			RAISE EXCEPTION 'all exams must be approved and require a grade';
		END IF;
	ELSEIF NEW.status='closed' AND OLD.status<>'exam_recognition' THEN
		RAISE EXCEPTION 'application status cannot pass from % -> %', OLD.status, NEW.status;
	END IF;

	RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_application_status_workflow() OWNER TO myuser;

--
-- Name: check_document_status_update(); Type: FUNCTION; Schema: public; Owner: myuser
--

CREATE FUNCTION public.check_document_status_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
	app_status VARCHAR(32);
BEGIN
	SELECT status INTO app_status
	FROM applications
	WHERE id = NEW.application_id;

	-- prevent status change when application is not in adequate status 
	IF NEW.document_type='learning_agreement' THEN
		IF app_status NOT IN ('created','learning_agreement_pending','mobility_ongoing') THEN
			RAISE EXCEPTION 'cannot change document when associated application is in % status', app_status;
		END IF;
	END IF;
	IF NEW.document_type='transcript' THEN
		IF app_status <> 'exam_recognition' THEN
			RAISE EXCEPTION 'cannot change document status when associated application is in % status', app_status;
		END IF;
	END IF;

	NEW.decision_date := CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_document_status_update() OWNER TO myuser;

--
-- Name: check_exam_mapping_insert(); Type: FUNCTION; Schema: public; Owner: myuser
--

CREATE FUNCTION public.check_exam_mapping_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    app_status VARCHAR(32);
BEGIN
    IF TG_OP='INSERT' THEN
        SELECT status INTO app_status
        FROM applications
        WHERE id=NEW.application_id;
    ELSE
        SELECT status INTO app_status
        FROM applications
        WHERE id=OLD.application_id;
    END IF;

    IF app_status NOT IN ('learning_agreement_pending','created','mobility_ongoing') THEN
        RAISE EXCEPTION 'cannot add or remove exams when associated application is in %', app_status;
    END IF;

    IF TG_OP='INSERT' THEN
        RETURN NEW;
    ELSE
        RETURN OLD;
    END IF;
END;
$$;


ALTER FUNCTION public.check_exam_mapping_insert() OWNER TO myuser;

--
-- Name: check_grade_changes(); Type: FUNCTION; Schema: public; Owner: myuser
--

CREATE FUNCTION public.check_grade_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    app_status VARCHAR(32);
    start_mobility_date DATE;
    end_mobility_date DATE;
BEGIN
    -- if exam mapping was already approved, it must not be changed
    IF OLD.status='approved' THEN
        RAISE EXCEPTION 'cannot update grade information when exam status is approved';
    END IF;

    -- check if exam grade changes are valid in the associated application
    SELECT status, date_arrived, date_departure
    INTO app_status, start_mobility_date, end_mobility_date
    FROM applications
    WHERE id=NEW.application_id;

    -- changes cannot be made if the application is not in exam_recognition status
    IF app_status <> 'exam_recognition' THEN
        RAISE EXCEPTION 'cannot update exam grade when associated application is in %', app_status;
    END IF;

    -- check if the passed date is within the mobility period
    IF NEW.date_passed IS NOT NULL
       AND (start_mobility_date IS NULL OR end_mobility_date IS NULL
            OR NEW.date_passed NOT BETWEEN start_mobility_date AND end_mobility_date) THEN
        RAISE EXCEPTION 'exam passed date must be between the arrival and departure date';
    END IF;

    NEW.status = 'pending';
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_grade_changes() OWNER TO myuser;

--
-- Name: check_mapped_exam_institutions(); Type: FUNCTION; Schema: public; Owner: myuser
--

CREATE FUNCTION public.check_mapped_exam_institutions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    app_host_inst       INT;
    app_sending_inst    INT;
    host_exam_inst      INT;
    sending_exam_inst   INT;
BEGIN
    SELECT host_institution, sending_institution
        INTO app_host_inst, app_sending_inst
        FROM applications
        WHERE id = NEW.application_id;

    SELECT id_institution INTO host_exam_inst
        FROM exams WHERE id = NEW.host_exam_id;

    SELECT id_institution INTO sending_exam_inst
        FROM exams WHERE id = NEW.sending_exam_id;

	-- this can be possible through an independent insert
    IF host_exam_inst <> app_host_inst THEN
        RAISE EXCEPTION 'host_exam_id institution does not match application host_institution';
    END IF;

	-- this can be possible through an independent insert
    IF sending_exam_inst <> app_sending_inst THEN
        RAISE EXCEPTION 'sending_exam_id institution does not match application sending_institution';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_mapped_exam_institutions() OWNER TO myuser;

--
-- Name: check_update_mapping(); Type: FUNCTION; Schema: public; Owner: myuser
--

CREATE FUNCTION public.check_update_mapping() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    app_status VARCHAR(32);
BEGIN
    SELECT status INTO app_status
    FROM applications
    WHERE id=NEW.application_id;

    -- cannot change mapping if not allowed in the current app status
    IF app_status NOT IN ('learning_agreement_pending','created','mobility_ongoing') THEN
        RAISE EXCEPTION 'invalid, cannot change exam mapping when associated application is in % status',app_status;
    END IF;

    NEW.status='pending';
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_update_mapping() OWNER TO myuser;

--
-- Name: check_update_status_mapped_exams(); Type: FUNCTION; Schema: public; Owner: myuser
--

CREATE FUNCTION public.check_update_status_mapped_exams() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    app_status VARCHAR(32);
BEGIN
    -- prevent status change when application is not in adequate status
    SELECT status INTO app_status
    FROM applications
    WHERE id = NEW.application_id;
    IF app_status NOT IN ('created','learning_agreement_pending','mobility_ongoing','exam_recognition') THEN
        RAISE EXCEPTION 'cannot change exam status when associated application is in % status', app_status;
    END IF;

    IF app_status = 'exam_recognition' THEN
        IF NEW.status <> 'pending'
           AND (NEW.grade = -1 OR NEW.date_passed IS NULL) THEN
            RAISE EXCEPTION 'cannot approve or reject exam without a grade';
        END IF;
    END IF;

    NEW.decision_date := CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_update_status_mapped_exams() OWNER TO myuser;

--
-- Name: mirror_partner_institution(); Type: FUNCTION; Schema: public; Owner: myuser
--

CREATE FUNCTION public.mirror_partner_institution() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM partner_institution
        WHERE id_institution = NEW.id_partner_institution
          AND id_partner_institution = NEW.id_institution
    ) THEN
        INSERT INTO partner_institution (id_institution, id_partner_institution)
            VALUES (NEW.id_partner_institution, NEW.id_institution);
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.mirror_partner_institution() OWNER TO myuser;

--
-- Name: set_modification_decision_date(); Type: FUNCTION; Schema: public; Owner: myuser
--

CREATE FUNCTION public.set_modification_decision_date() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.status IN ('approved', 'rejected') THEN
        NEW.decision_date := CURRENT_TIMESTAMP;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_modification_decision_date() OWNER TO myuser;

--
-- Name: update_application_on_upload(); Type: FUNCTION; Schema: public; Owner: myuser
--

CREATE FUNCTION public.update_application_on_upload() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    app_status VARCHAR(32);
BEGIN
    SELECT status
        INTO app_status
        FROM applications
        WHERE id = NEW.application_id;

    IF NEW.document_type = 'learning_agreement' THEN
        -- check if the status of associated application is valid
        IF app_status NOT IN ('created','learning_agreement_pending','mobility_ongoing') THEN
            RAISE EXCEPTION 'new learning agreement document cannot be changed while the application is in % status', app_status;
        END IF;

        IF app_status = 'created' THEN
            UPDATE applications SET status='learning_agreement_pending' WHERE id=NEW.application_id;
        END IF;
    ELSE
        -- if it's not a LA, it must be a transcript of records (because of check constraint), check if the status of associated application is valid
        IF app_status <> 'exam_recognition' THEN
            RAISE EXCEPTION 'new transcript of records document cannot be changed while the application is in % status', app_status;
        END IF;
    END IF;

    RETURN NEW;
END
$$;


ALTER FUNCTION public.update_application_on_upload() OWNER TO myuser;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: myuser
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO myuser;

--
-- Name: applications; Type: TABLE; Schema: public; Owner: myuser
--

CREATE TABLE public.applications (
    id integer NOT NULL,
    year integer NOT NULL,
    semester character varying(50) NOT NULL,
    status character varying(32) NOT NULL,
    date_submitted timestamp with time zone DEFAULT now(),
    date_arrived date,
    date_departure date,
    notes text,
    referent_id integer,
    sending_institution integer NOT NULL,
    host_institution integer NOT NULL,
    user_id integer NOT NULL,
    CONSTRAINT different_host_sending CHECK ((host_institution <> sending_institution)),
    CONSTRAINT valid_academic_year CHECK ((((date_arrived IS NULL) OR ((EXTRACT(year FROM date_arrived) = (year)::numeric) OR (EXTRACT(year FROM date_arrived) = ((year + 1))::numeric))) AND ((date_departure IS NULL) OR ((EXTRACT(year FROM date_departure) = (year)::numeric) OR (EXTRACT(year FROM date_departure) = ((year + 1))::numeric))))),
    CONSTRAINT valid_mobility_dates CHECK (((date_arrived IS NULL) OR (date_departure IS NULL) OR (date_departure >= date_arrived))),
    CONSTRAINT valid_semester CHECK (((semester)::text = ANY ((ARRAY['first'::character varying, 'second'::character varying, 'full'::character varying])::text[]))),
    CONSTRAINT valid_status CHECK (((status)::text = ANY ((ARRAY['created'::character varying, 'learning_agreement_pending'::character varying, 'pre_departure_completed'::character varying, 'mobility_ongoing'::character varying, 'exam_recognition'::character varying, 'closed'::character varying])::text[])))
);


ALTER TABLE public.applications OWNER TO myuser;

--
-- Name: applications_id_seq; Type: SEQUENCE; Schema: public; Owner: myuser
--

CREATE SEQUENCE public.applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.applications_id_seq OWNER TO myuser;

--
-- Name: applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: myuser
--

ALTER SEQUENCE public.applications_id_seq OWNED BY public.applications.id;


--
-- Name: exams; Type: TABLE; Schema: public; Owner: myuser
--

CREATE TABLE public.exams (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    credits integer NOT NULL,
    id_institution integer NOT NULL
);


ALTER TABLE public.exams OWNER TO myuser;

--
-- Name: exams_id_seq; Type: SEQUENCE; Schema: public; Owner: myuser
--

CREATE SEQUENCE public.exams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exams_id_seq OWNER TO myuser;

--
-- Name: exams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: myuser
--

ALTER SEQUENCE public.exams_id_seq OWNED BY public.exams.id;


--
-- Name: institutions; Type: TABLE; Schema: public; Owner: myuser
--

CREATE TABLE public.institutions (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    country character varying(255) NOT NULL,
    city character varying(255) NOT NULL
);


ALTER TABLE public.institutions OWNER TO myuser;

--
-- Name: institutions_id_seq; Type: SEQUENCE; Schema: public; Owner: myuser
--

CREATE SEQUENCE public.institutions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.institutions_id_seq OWNER TO myuser;

--
-- Name: institutions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: myuser
--

ALTER SEQUENCE public.institutions_id_seq OWNED BY public.institutions.id;


--
-- Name: la_modification_exams; Type: TABLE; Schema: public; Owner: myuser
--

CREATE TABLE public.la_modification_exams (
    id integer NOT NULL,
    modification_id integer NOT NULL,
    host_exam_id integer NOT NULL,
    sending_exam_id integer NOT NULL,
    grade integer,
    date_passed date,
    status character varying(32) NOT NULL,
    notes text,
    decision_date timestamp with time zone
);


ALTER TABLE public.la_modification_exams OWNER TO myuser;

--
-- Name: la_modification_exams_id_seq; Type: SEQUENCE; Schema: public; Owner: myuser
--

CREATE SEQUENCE public.la_modification_exams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.la_modification_exams_id_seq OWNER TO myuser;

--
-- Name: la_modification_exams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: myuser
--

ALTER SEQUENCE public.la_modification_exams_id_seq OWNED BY public.la_modification_exams.id;


--
-- Name: la_modifications; Type: TABLE; Schema: public; Owner: myuser
--

CREATE TABLE public.la_modifications (
    id integer NOT NULL,
    application_id integer NOT NULL,
    description text NOT NULL,
    status character varying(32) NOT NULL,
    decision_date timestamp with time zone,
    notes text,
    document_id integer,
    CONSTRAINT valid_modification_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.la_modifications OWNER TO myuser;

--
-- Name: la_modifications_id_seq; Type: SEQUENCE; Schema: public; Owner: myuser
--

CREATE SEQUENCE public.la_modifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.la_modifications_id_seq OWNER TO myuser;

--
-- Name: la_modifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: myuser
--

ALTER SEQUENCE public.la_modifications_id_seq OWNED BY public.la_modifications.id;


--
-- Name: mapped_exams; Type: TABLE; Schema: public; Owner: myuser
--

CREATE TABLE public.mapped_exams (
    id integer NOT NULL,
    application_id integer NOT NULL,
    date_passed date,
    grade integer,
    status character varying(32) NOT NULL,
    decision_date timestamp with time zone,
    notes text,
    host_exam_id integer NOT NULL,
    sending_exam_id integer NOT NULL,
    CONSTRAINT valid_grade CHECK (((grade = '-1'::integer) OR ((grade > 17) AND (grade <= 30)))),
    CONSTRAINT valid_grade_date CHECK ((((grade = '-1'::integer) AND (date_passed IS NULL)) OR ((grade <> '-1'::integer) AND (date_passed IS NOT NULL)))),
    CONSTRAINT valid_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.mapped_exams OWNER TO myuser;

--
-- Name: mapped_exams_id_seq; Type: SEQUENCE; Schema: public; Owner: myuser
--

CREATE SEQUENCE public.mapped_exams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mapped_exams_id_seq OWNER TO myuser;

--
-- Name: mapped_exams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: myuser
--

ALTER SEQUENCE public.mapped_exams_id_seq OWNED BY public.mapped_exams.id;


--
-- Name: partner_institution; Type: TABLE; Schema: public; Owner: myuser
--

CREATE TABLE public.partner_institution (
    id integer NOT NULL,
    id_institution integer NOT NULL,
    id_partner_institution integer NOT NULL,
    CONSTRAINT self_partner CHECK ((id_institution <> id_partner_institution))
);


ALTER TABLE public.partner_institution OWNER TO myuser;

--
-- Name: partner_institution_id_seq; Type: SEQUENCE; Schema: public; Owner: myuser
--

CREATE SEQUENCE public.partner_institution_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.partner_institution_id_seq OWNER TO myuser;

--
-- Name: partner_institution_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: myuser
--

ALTER SEQUENCE public.partner_institution_id_seq OWNED BY public.partner_institution.id;


--
-- Name: uploaded_documents; Type: TABLE; Schema: public; Owner: myuser
--

CREATE TABLE public.uploaded_documents (
    id integer NOT NULL,
    document_type character varying(50) NOT NULL,
    file_path character varying(255) NOT NULL,
    date_updated timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(32) NOT NULL,
    decision_date timestamp with time zone,
    notes text,
    user_id integer NOT NULL,
    application_id integer NOT NULL,
    CONSTRAINT valid_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT valid_type CHECK (((document_type)::text = ANY ((ARRAY['learning_agreement'::character varying, 'transcript'::character varying])::text[])))
);


ALTER TABLE public.uploaded_documents OWNER TO myuser;

--
-- Name: uploaded_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: myuser
--

CREATE SEQUENCE public.uploaded_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.uploaded_documents_id_seq OWNER TO myuser;

--
-- Name: uploaded_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: myuser
--

ALTER SEQUENCE public.uploaded_documents_id_seq OWNED BY public.uploaded_documents.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: myuser
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    firstname character varying(255) NOT NULL,
    lastname character varying(255) NOT NULL,
    id_institution integer NOT NULL,
    CONSTRAINT allowed_user_roles CHECK ((((role)::text = 'student'::text) OR ((role)::text = 'referent'::text) OR ((role)::text = 'staff'::text)))
);


ALTER TABLE public.users OWNER TO myuser;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: myuser
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO myuser;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: myuser
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: applications id; Type: DEFAULT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.applications ALTER COLUMN id SET DEFAULT nextval('public.applications_id_seq'::regclass);


--
-- Name: exams id; Type: DEFAULT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.exams ALTER COLUMN id SET DEFAULT nextval('public.exams_id_seq'::regclass);


--
-- Name: institutions id; Type: DEFAULT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.institutions ALTER COLUMN id SET DEFAULT nextval('public.institutions_id_seq'::regclass);


--
-- Name: la_modification_exams id; Type: DEFAULT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.la_modification_exams ALTER COLUMN id SET DEFAULT nextval('public.la_modification_exams_id_seq'::regclass);


--
-- Name: la_modifications id; Type: DEFAULT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.la_modifications ALTER COLUMN id SET DEFAULT nextval('public.la_modifications_id_seq'::regclass);


--
-- Name: mapped_exams id; Type: DEFAULT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.mapped_exams ALTER COLUMN id SET DEFAULT nextval('public.mapped_exams_id_seq'::regclass);


--
-- Name: partner_institution id; Type: DEFAULT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.partner_institution ALTER COLUMN id SET DEFAULT nextval('public.partner_institution_id_seq'::regclass);


--
-- Name: uploaded_documents id; Type: DEFAULT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.uploaded_documents ALTER COLUMN id SET DEFAULT nextval('public.uploaded_documents_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: myuser
--

COPY public.alembic_version (version_num) FROM stdin;
b7f3d2a91c04
\.


--
-- Data for Name: applications; Type: TABLE DATA; Schema: public; Owner: myuser
--

COPY public.applications (id, year, semester, status, date_submitted, date_arrived, date_departure, notes, referent_id, sending_institution, host_institution, user_id) FROM stdin;
28	2026	first	closed	2026-07-05 20:32:19.174187+00	2026-07-01	2026-07-30		49	1	6	1
\.


--
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: myuser
--

COPY public.exams (id, code, name, credits, id_institution) FROM stdin;
1	CT3-CS0101	Distributed Systems	9	1
2	CT3-CS0102	Compilers	9	1
3	CT3-CS0103	Operating Systems	6	1
4	CT3-CS0104	Algorithm Design	9	1
5	CT3-CS0105	Computer Architecture	6	1
6	FRA-CS0201	Formal Methods	6	2
7	FRA-CS0202	Logic Programming	6	2
8	FRA-CS0203	Type Theory	6	2
9	FRA-CS0204	Cryptography	6	2
10	FRA-CS0205	Parallel Computing	6	2
11	TUM-CS0301	Embedded Systems	12	3
12	TUM-CS0302	Real-Time Systems	9	3
13	TUM-CS0303	Digital Signal Processing	9	3
14	TUM-CS0304	Control Theory	12	3
15	TUM-CS0305	Hardware Design	12	3
16	OXF-CS0401	Machine Learning	9	4
17	OXF-CS0402	Neural Networks	6	4
18	OXF-CS0403	Computer Vision	9	4
19	OXF-CS0404	Data Mining	9	4
20	OXF-CS0405	Probabilistic Graphical Models	6	4
21	AMS-CS0501	Software Engineering	9	5
22	AMS-CS0502	Design Patterns	12	5
23	AMS-CS0503	Agile Methods	9	5
24	AMS-CS0504	Testing & Verification	9	5
25	AMS-CS0505	DevOps	6	5
26	ETH-CS0601	Web Engineering	6	6
27	ETH-CS0602	Cloud Computing	9	6
28	ETH-CS0603	Microservices	12	6
29	ETH-CS0604	REST API Design	6	6
30	ETH-CS0605	Containerization	6	6
31	MADR-CS0701	Cybersecurity	9	7
32	MADR-CS0702	Network Security	12	7
33	MADR-CS0703	Ethical Hacking	6	7
34	MADR-CS0704	Digital Forensics	9	7
35	MADR-CS0705	Malware Analysis	6	7
36	WARSW-CS0801	Database Systems	6	8
37	WARSW-CS0802	Query Optimization	12	8
38	WARSW-CS0803	NoSQL Systems	9	8
39	WARSW-CS0804	Data Warehousing	12	8
40	WARSW-CS0805	Transaction Management	6	8
41	CHU-CS0901	Human-Computer Interaction	9	9
42	CHU-CS0902	UX Design	6	9
43	CHU-CS0903	Accessibility	9	9
44	CHU-CS0904	Cognitive Ergonomics	6	9
45	CHU-CS0905	Interaction Prototyping	6	9
46	KUL-CS1001	Mobile Computing	9	10
47	KUL-CS1002	IoT Systems	6	10
48	KUL-CS1003	Edge Computing	9	10
49	KUL-CS1004	Wireless Protocols	6	10
50	KUL-CS1005	Sensor Networks	6	10
51	WIEN-CS1101	Computer Graphics	9	11
52	WIEN-CS1102	3D Rendering	6	11
53	WIEN-CS1103	Game Engine Design	9	11
54	WIEN-CS1104	Shader Programming	9	11
55	WIEN-CS1105	Geometric Modeling	6	11
56	HEL-CS1201	Bioinformatics	9	12
57	HEL-CS1202	Computational Genomics	9	12
58	HEL-CS1203	Protein Modeling	6	12
59	HEL-CS1204	Medical Imaging	6	12
60	HEL-CS1205	Health Informatics	6	12
61	STOSWE-CS1301	Quantum Computing	6	13
62	STOSWE-CS1302	Quantum Algorithms	12	13
63	STOSWE-CS1303	Post-Quantum Cryptography	6	13
64	STOSWE-CS1304	Quantum Error Correction	12	13
65	STOSWE-CS1305	Quantum Programming	9	13
66	COP-CS1401	Robotics	9	14
67	COP-CS1402	Motion Planning	6	14
68	COP-CS1403	Computer Vision for Robotics	9	14
69	COP-CS1404	ROS Programming	12	14
70	COP-CS1405	Autonomous Systems	6	14
71	OSLO-CS1501	Natural Language Processing	6	15
72	OSLO-CS1502	Speech Recognition	6	15
73	OSLO-CS1503	Information Retrieval	6	15
74	OSLO-CS1504	Text Mining	6	15
75	OSLO-CS1505	Computational Linguistics	9	15
76	LISBOA-CS1601	High-Performance Computing	12	16
77	LISBOA-CS1602	GPU Programming	9	16
78	LISBOA-CS1603	Cluster Computing	6	16
79	LISBOA-CS1604	Scientific Computing	9	16
80	LISBOA-CS1605	Numerical Methods	12	16
81	ATHNS-CS1701	Network Engineering	6	17
82	ATHNS-CS1702	Routing Protocols	6	17
83	ATHNS-CS1703	SDN	6	17
84	ATHNS-CS1704	Network Virtualization	9	17
85	ATHNS-CS1705	5G Systems	6	17
86	UHUNG-CS1801	Functional Programming	9	18
87	UHUNG-CS1802	Haskell	6	18
88	UHUNG-CS1803	Scala	6	18
89	UHUNG-CS1804	Category Theory for CS	9	18
90	UHUNG-CS1805	Lambda Calculus	9	18
91	BUCHRST-CS1901	Systems Programming	6	19
92	BUCHRST-CS1902	Rust Programming	6	19
93	BUCHRST-CS1903	Memory Safety	12	19
94	BUCHRST-CS1904	Low-Level Optimization	6	19
95	BUCHRST-CS1905	Linkers & Loaders	9	19
96	ZAGR-CS2001	Data Science	6	20
97	ZAGR-CS2002	Statistical Learning	9	20
98	ZAGR-CS2003	Big Data Processing	9	20
99	ZAGR-CS2004	Data Visualization	6	20
100	ZAGR-CS2005	Feature Engineering	6	20
\.


--
-- Data for Name: institutions; Type: TABLE DATA; Schema: public; Owner: myuser
--

COPY public.institutions (id, name, country, city) FROM stdin;
1	Ca' Foscari University of Venice	Italy	Venice
2	Sorbonne University	France	Paris
3	Ludwig Maximilian University of Munich	Germany	Munich
4	University of Oxford	England	Oxford
5	University of Amsterdam	Netherlands	Amsterdam
6	ETH Zurich	Switzerland	Zurich
7	Complutense University of Madrid	Spain	Madrid
8	University of Warsaw	Poland	Warsaw
9	Charles University	Czech Republic	Prague
10	KU Leuven	Belgium	Leuven
11	University of Vienna	Austria	Vienna
12	University of Helsinki	Finland	Helsinki
13	Stockholm University	Sweden	Stockholm
14	University of Copenhagen	Denmark	Copenhagen
15	University of Oslo	Norway	Oslo
16	University of Lisbon	Portugal	Lisbon
17	University of Athens	Greece	Athens
18	Eötvös Loránd University	Hungary	Budapest
19	University of Bucharest	Romania	Bucharest
20	University of Zagreb	Croatia	Zagreb
\.


--
-- Data for Name: la_modification_exams; Type: TABLE DATA; Schema: public; Owner: myuser
--

COPY public.la_modification_exams (id, modification_id, host_exam_id, sending_exam_id, grade, date_passed, status, notes, decision_date) FROM stdin;
35	19	28	1	-1	\N	approved		2026-07-05 20:32:37.932534+00
36	19	29	3	-1	\N	approved		2026-07-05 20:32:38.597376+00
\.


--
-- Data for Name: la_modifications; Type: TABLE DATA; Schema: public; Owner: myuser
--

COPY public.la_modifications (id, application_id, description, status, decision_date, notes, document_id) FROM stdin;
19	28	test	rejected	2026-07-05 20:34:15.243035+00	ta	\N
\.


--
-- Data for Name: mapped_exams; Type: TABLE DATA; Schema: public; Owner: myuser
--

COPY public.mapped_exams (id, application_id, date_passed, grade, status, decision_date, notes, host_exam_id, sending_exam_id) FROM stdin;
233	28	2026-07-15	19	approved	2026-07-05 20:35:04.28618+00		28	1
234	28	2026-07-29	19	approved	2026-07-05 20:35:04.929924+00		29	3
\.


--
-- Data for Name: partner_institution; Type: TABLE DATA; Schema: public; Owner: myuser
--

COPY public.partner_institution (id, id_institution, id_partner_institution) FROM stdin;
1	1	3
2	1	4
3	1	5
4	1	6
5	1	7
6	2	5
7	2	6
8	2	10
9	2	18
10	2	19
11	3	11
12	3	16
13	3	17
14	4	9
15	4	12
16	4	13
17	4	16
18	5	11
19	5	16
20	5	17
21	6	11
22	6	13
23	6	20
24	7	10
25	7	14
26	7	16
27	8	15
28	8	20
29	9	15
30	9	17
31	10	13
32	11	12
33	11	15
34	12	17
35	12	20
36	13	18
37	13	19
38	14	16
41	14	1
\.


--
-- Data for Name: uploaded_documents; Type: TABLE DATA; Schema: public; Owner: myuser
--

COPY public.uploaded_documents (id, document_type, file_path, date_updated, status, decision_date, notes, user_id, application_id) FROM stdin;
68	learning_agreement	/app/uploads/applications/28/JOSEPH_FRIGO_learning-agreement-studies.pdf	2026-07-05 20:32:19.235191+00	approved	2026-07-05 20:32:39.739681+00		1	28
70	transcript	/app/uploads/applications/28/(OLD)FRIGO_JOSEPH_Learning_Agreement.pdf	2026-07-05 20:34:34.12926+00	approved	2026-07-05 20:35:03.226654+00		1	28
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: myuser
--

COPY public.users (id, email, password_hash, role, firstname, lastname, id_institution) FROM stdin;
1	marco.rossi@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Marco	Rossi	1
2	giulia.ferrari@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Giulia	Ferrari	1
3	luca.bianchi@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Luca	Bianchi	1
4	sofia.romano@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Sofia	Romano	1
5	matteo.conti@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Matteo	Conti	1
6	elena.ricci@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Elena	Ricci	1
7	davide.marino@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Davide	Marino	1
8	chiara.greco@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Chiara	Greco	1
9	andrea.bruno@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Andrea	Bruno	1
10	valentina.gallo@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Valentina	Gallo	1
11	pierre.martin@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Pierre	Martin	2
12	camille.durand@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Camille	Durand	2
13	hans.mueller@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Hans	Mueller	3
14	anna.schmidt@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Anna	Schmidt	3
15	james.smith@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	James	Smith	4
16	emily.jones@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Emily	Jones	4
17	lars.janssen@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Lars	Janssen	5
18	sophie.vandenberg@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Sophie	Vandenberg	5
19	felix.keller@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Felix	Keller	6
20	nina.brunner@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Nina	Brunner	6
21	carlos.garcia@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Carlos	Garcia	7
22	lucia.fernandez@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Lucia	Fernandez	7
23	piotr.kowalski@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Piotr	Kowalski	8
24	katarzyna.nowak@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Katarzyna	Nowak	8
25	jan.novak@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Jan	Novak	9
26	petra.dvorak@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Petra	Dvorak	9
27	pieter.desmet@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Pieter	Desmet	10
28	elien.claes@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Elien	Claes	10
29	stefan.huber@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Stefan	Huber	11
30	lisa.wagner@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Lisa	Wagner	11
31	mikko.virtanen@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Mikko	Virtanen	12
32	aino.makinen@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Aino	Makinen	12
33	erik.lindqvist@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Erik	Lindqvist	13
34	maja.johansson@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Maja	Johansson	13
35	rasmus.nielsen@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Rasmus	Nielsen	14
36	ida.andersen@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Ida	Andersen	14
37	olav.berg@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Olav	Berg	15
38	ingrid.hansen@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Ingrid	Hansen	15
39	joao.silva@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	João	Silva	16
40	ana.costa@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Ana	Costa	16
41	nikos.papadopoulos@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Nikos	Papadopoulos	17
42	eleni.georgiou@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Eleni	Georgiou	17
43	balazs.nagy@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Balázs	Nagy	18
44	reka.kovacs@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Réka	Kovács	18
45	andrei.popescu@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Andrei	Popescu	19
46	ioana.ionescu@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Ioana	Ionescu	19
47	luka.horvat@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Luka	Horvat	20
48	ana.maric@stud.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	student	Ana	Marić	20
49	giovanni.ferrari@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Giovanni	Ferrari	1
50	laura.bianchi@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Laura	Bianchi	1
51	carlo.rossi@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Carlo	Rossi	1
52	jean.dupont@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Jean	Dupont	2
53	marie.leroy@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Marie	Leroy	2
54	thomas.bauer@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Thomas	Bauer	3
55	julia.richter@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Julia	Richter	3
56	william.taylor@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	William	Taylor	4
57	sarah.wright@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Sarah	Wright	4
58	jan.dekker@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Jan	Dekker	5
59	maria.berg@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Maria	Berg	6
60	pedro.alves@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Pedro	Alves	7
61	agnieszka.wisniewska@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Agnieszka	Wiśniewska	8
62	tomas.blazek@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Tomáš	Blažek	9
63	inge.willems@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Inge	Willems	10
64	markus.gruber@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Markus	Gruber	11
65	sari.heikkinen@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Sari	Heikkinen	12
66	anders.svensson@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Anders	Svensson	13
67	anne.christensen@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Anne	Christensen	14
68	kari.olsen@prof.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	referent	Kari	Olsen	15
69	giuseppe.verdi@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Giuseppe	Verdi	1
70	anna.colombo@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Anna	Colombo	1
71	roberto.mancini@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Roberto	Mancini	1
72	claire.moreau@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Claire	Moreau	2
73	francois.simon@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	François	Simon	2
74	klaus.zimmer@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Klaus	Zimmer	3
75	heike.fischer@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Heike	Fischer	3
76	oliver.brown@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Oliver	Brown	4
77	charlotte.davies@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Charlotte	Davies	4
78	emma.visser@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Emma	Visser	5
79	david.meier@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	David	Meier	6
80	carmen.ruiz@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Carmen	Ruiz	7
81	marek.wojcik@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Marek	Wójcik	8
82	lenka.horakova@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Lenka	Horáková	9
83	thomas.claes@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Thomas	Claes	10
84	monika.fischer@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Monika	Fischer	11
85	paivi.leinonen@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Päivi	Leinonen	12
86	per.nilsson@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Per	Nilsson	13
87	mette.larsen@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Mette	Larsen	14
88	sigrid.dahl@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Sigrid	Dahl	15
89	rui.ferreira@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Rui	Ferreira	16
90	stavros.alexiou@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Stavros	Alexiou	17
91	zoltan.fekete@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Zoltán	Fekete	18
92	mihai.dinu@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Mihai	Dinu	19
93	tomislav.babic@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Tomislav	Babić	20
94	katia.lombardi@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Katia	Lombardi	16
95	nuno.santos@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Nuno	Santos	17
96	george.pappas@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	George	Pappas	18
97	diana.stoica@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Diana	Stoica	19
98	ivana.petrovic@staff.uni.com	pbkdf2:sha256:1000000$5Y4gz7EU8aIfEBbW$1051a735da5485c3f3cc9fa20ac0e7cbf603f9850a2670f5dd8ab2b44fc58fff	staff	Ivana	Petrović	20
\.


--
-- Name: applications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: myuser
--

SELECT pg_catalog.setval('public.applications_id_seq', 60, true);


--
-- Name: exams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: myuser
--

SELECT pg_catalog.setval('public.exams_id_seq', 101, true);


--
-- Name: institutions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: myuser
--

SELECT pg_catalog.setval('public.institutions_id_seq', 20, true);


--
-- Name: la_modification_exams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: myuser
--

SELECT pg_catalog.setval('public.la_modification_exams_id_seq', 63, true);


--
-- Name: la_modifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: myuser
--

SELECT pg_catalog.setval('public.la_modifications_id_seq', 49, true);


--
-- Name: mapped_exams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: myuser
--

SELECT pg_catalog.setval('public.mapped_exams_id_seq', 254, true);


--
-- Name: partner_institution_id_seq; Type: SEQUENCE SET; Schema: public; Owner: myuser
--

SELECT pg_catalog.setval('public.partner_institution_id_seq', 41, true);


--
-- Name: uploaded_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: myuser
--

SELECT pg_catalog.setval('public.uploaded_documents_id_seq', 100, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: myuser
--

SELECT pg_catalog.setval('public.users_id_seq', 99, true);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: exams exams_code_id_institution_key; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_code_id_institution_key UNIQUE (code, id_institution);


--
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);


--
-- Name: institutions institutions_pkey; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.institutions
    ADD CONSTRAINT institutions_pkey PRIMARY KEY (id);


--
-- Name: la_modification_exams la_modification_exams_modification_id_host_exam_id_key; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.la_modification_exams
    ADD CONSTRAINT la_modification_exams_modification_id_host_exam_id_key UNIQUE (modification_id, host_exam_id);


--
-- Name: la_modification_exams la_modification_exams_modification_id_sending_exam_id_key; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.la_modification_exams
    ADD CONSTRAINT la_modification_exams_modification_id_sending_exam_id_key UNIQUE (modification_id, sending_exam_id);


--
-- Name: la_modification_exams la_modification_exams_pkey; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.la_modification_exams
    ADD CONSTRAINT la_modification_exams_pkey PRIMARY KEY (id);


--
-- Name: la_modifications la_modifications_pkey; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.la_modifications
    ADD CONSTRAINT la_modifications_pkey PRIMARY KEY (id);


--
-- Name: mapped_exams mapped_exams_application_id_host_exam_id_key; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.mapped_exams
    ADD CONSTRAINT mapped_exams_application_id_host_exam_id_key UNIQUE (application_id, host_exam_id);


--
-- Name: mapped_exams mapped_exams_application_id_sending_exam_id_key; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.mapped_exams
    ADD CONSTRAINT mapped_exams_application_id_sending_exam_id_key UNIQUE (application_id, sending_exam_id);


--
-- Name: mapped_exams mapped_exams_pkey; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.mapped_exams
    ADD CONSTRAINT mapped_exams_pkey PRIMARY KEY (id);


--
-- Name: partner_institution partner_institution_id_institution_id_partner_institution_key; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.partner_institution
    ADD CONSTRAINT partner_institution_id_institution_id_partner_institution_key UNIQUE (id_institution, id_partner_institution);


--
-- Name: partner_institution partner_institution_pkey; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.partner_institution
    ADD CONSTRAINT partner_institution_pkey PRIMARY KEY (id);


--
-- Name: uploaded_documents uploaded_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.uploaded_documents
    ADD CONSTRAINT uploaded_documents_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_id_id_institution_key; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_id_institution_key UNIQUE (id, id_institution);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: applications applicaiton_status_workflow; Type: TRIGGER; Schema: public; Owner: myuser
--

CREATE TRIGGER applicaiton_status_workflow BEFORE UPDATE ON public.applications FOR EACH ROW WHEN (((new.status)::text <> (old.status)::text)) EXECUTE FUNCTION public.check_application_status_workflow();


--
-- Name: uploaded_documents applicaiton_update_on_upload; Type: TRIGGER; Schema: public; Owner: myuser
--

CREATE TRIGGER applicaiton_update_on_upload BEFORE INSERT ON public.uploaded_documents FOR EACH ROW EXECUTE FUNCTION public.update_application_on_upload();


--
-- Name: applications application_data_check; Type: TRIGGER; Schema: public; Owner: myuser
--

CREATE TRIGGER application_data_check BEFORE INSERT OR UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.check_application_data();


--
-- Name: uploaded_documents document_status_update_check; Type: TRIGGER; Schema: public; Owner: myuser
--

CREATE TRIGGER document_status_update_check BEFORE UPDATE ON public.uploaded_documents FOR EACH ROW WHEN (((old.status)::text <> (new.status)::text)) EXECUTE FUNCTION public.check_document_status_update();


--
-- Name: mapped_exams exam_grade_changes_check; Type: TRIGGER; Schema: public; Owner: myuser
--

CREATE TRIGGER exam_grade_changes_check BEFORE UPDATE ON public.mapped_exams FOR EACH ROW WHEN (((new.grade IS DISTINCT FROM old.grade) OR (new.date_passed IS DISTINCT FROM old.date_passed))) EXECUTE FUNCTION public.check_grade_changes();


--
-- Name: mapped_exams exam_mapping_insert_check; Type: TRIGGER; Schema: public; Owner: myuser
--

CREATE TRIGGER exam_mapping_insert_check BEFORE INSERT OR DELETE ON public.mapped_exams FOR EACH ROW EXECUTE FUNCTION public.check_exam_mapping_insert();


--
-- Name: mapped_exams exam_mapping_update_check; Type: TRIGGER; Schema: public; Owner: myuser
--

CREATE TRIGGER exam_mapping_update_check BEFORE UPDATE ON public.mapped_exams FOR EACH ROW WHEN (((new.sending_exam_id <> old.sending_exam_id) OR (new.host_exam_id <> old.host_exam_id))) EXECUTE FUNCTION public.check_update_mapping();


--
-- Name: la_modifications la_modification_decision_date; Type: TRIGGER; Schema: public; Owner: myuser
--

CREATE TRIGGER la_modification_decision_date BEFORE UPDATE ON public.la_modifications FOR EACH ROW WHEN (((old.status)::text <> (new.status)::text)) EXECUTE FUNCTION public.set_modification_decision_date();


--
-- Name: mapped_exams mapped_exam_institutions_check; Type: TRIGGER; Schema: public; Owner: myuser
--

CREATE TRIGGER mapped_exam_institutions_check BEFORE INSERT OR UPDATE ON public.mapped_exams FOR EACH ROW EXECUTE FUNCTION public.check_mapped_exam_institutions();


--
-- Name: mapped_exams mapped_exam_update_status_check; Type: TRIGGER; Schema: public; Owner: myuser
--

CREATE TRIGGER mapped_exam_update_status_check BEFORE UPDATE ON public.mapped_exams FOR EACH ROW WHEN (((old.status)::text <> (new.status)::text)) EXECUTE FUNCTION public.check_update_status_mapped_exams();


--
-- Name: partner_institution partner_institution_symmetry; Type: TRIGGER; Schema: public; Owner: myuser
--

CREATE TRIGGER partner_institution_symmetry AFTER INSERT ON public.partner_institution FOR EACH ROW EXECUTE FUNCTION public.mirror_partner_institution();


--
-- Name: applications applications_host_institution_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_host_institution_fkey FOREIGN KEY (host_institution) REFERENCES public.institutions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: applications applications_referent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_referent_id_fkey FOREIGN KEY (referent_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: applications applications_referent_id_sending_institution_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_referent_id_sending_institution_fkey FOREIGN KEY (referent_id, sending_institution) REFERENCES public.users(id, id_institution);


--
-- Name: applications applications_sending_institution_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_sending_institution_fkey FOREIGN KEY (sending_institution) REFERENCES public.institutions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: applications applications_sending_institution_host_institution_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_sending_institution_host_institution_fkey FOREIGN KEY (sending_institution, host_institution) REFERENCES public.partner_institution(id_institution, id_partner_institution) ON UPDATE CASCADE;


--
-- Name: applications applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: applications applications_user_id_sending_institution_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_user_id_sending_institution_fkey FOREIGN KEY (user_id, sending_institution) REFERENCES public.users(id, id_institution);


--
-- Name: exams exams_id_institution_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_id_institution_fkey FOREIGN KEY (id_institution) REFERENCES public.institutions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: la_modification_exams la_modification_exams_host_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.la_modification_exams
    ADD CONSTRAINT la_modification_exams_host_exam_id_fkey FOREIGN KEY (host_exam_id) REFERENCES public.exams(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: la_modification_exams la_modification_exams_modification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.la_modification_exams
    ADD CONSTRAINT la_modification_exams_modification_id_fkey FOREIGN KEY (modification_id) REFERENCES public.la_modifications(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: la_modification_exams la_modification_exams_sending_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.la_modification_exams
    ADD CONSTRAINT la_modification_exams_sending_exam_id_fkey FOREIGN KEY (sending_exam_id) REFERENCES public.exams(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: la_modifications la_modifications_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.la_modifications
    ADD CONSTRAINT la_modifications_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: la_modifications la_modifications_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.la_modifications
    ADD CONSTRAINT la_modifications_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.uploaded_documents(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: mapped_exams mapped_exams_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.mapped_exams
    ADD CONSTRAINT mapped_exams_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: mapped_exams mapped_exams_host_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.mapped_exams
    ADD CONSTRAINT mapped_exams_host_exam_id_fkey FOREIGN KEY (host_exam_id) REFERENCES public.exams(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: mapped_exams mapped_exams_sending_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.mapped_exams
    ADD CONSTRAINT mapped_exams_sending_exam_id_fkey FOREIGN KEY (sending_exam_id) REFERENCES public.exams(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: partner_institution partner_institution_id_institution_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.partner_institution
    ADD CONSTRAINT partner_institution_id_institution_fkey FOREIGN KEY (id_institution) REFERENCES public.institutions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: partner_institution partner_institution_id_partner_institution_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.partner_institution
    ADD CONSTRAINT partner_institution_id_partner_institution_fkey FOREIGN KEY (id_partner_institution) REFERENCES public.institutions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: uploaded_documents uploaded_documents_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.uploaded_documents
    ADD CONSTRAINT uploaded_documents_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: uploaded_documents uploaded_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.uploaded_documents
    ADD CONSTRAINT uploaded_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_id_institution_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_institution_fkey FOREIGN KEY (id_institution) REFERENCES public.institutions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict FS3jMbHdEXJ30TM9WOO2glozu5yS0myiG6VcpfJA4ScVYBnYawodB4f8rVIFZky

