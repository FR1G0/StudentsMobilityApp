--
-- PostgreSQL database dump
--

\restrict cDpeYIQswHUyul7hcIbNaDXa7aYfGbEdlMhWsuRpyCD5qgyUBEANUGMd4nL2C3a

-- Dumped from database version 18.4
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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.applications (
    id integer NOT NULL,
    year integer NOT NULL,
    semester character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    date_submitted timestamp without time zone NOT NULL,
    sending_institution integer NOT NULL,
    host_institution integer NOT NULL,
    user_id integer NOT NULL
);


ALTER TABLE public.applications OWNER TO myuser;

--
-- Name: applications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
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
-- Name: applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.applications_id_seq OWNED BY public.applications.id;


--
-- Name: exams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exams (
    code character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    id_institution integer NOT NULL,
    credits integer NOT NULL
);


ALTER TABLE public.exams OWNER TO myuser;

--
-- Name: institutions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.institutions (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    country character varying(255) NOT NULL,
    city character varying(255) NOT NULL
);


ALTER TABLE public.institutions OWNER TO myuser;

--
-- Name: institutions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
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
-- Name: institutions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.institutions_id_seq OWNED BY public.institutions.id;


--
-- Name: mapped_exams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mapped_exams (
    id integer NOT NULL,
    application_id integer NOT NULL,
    exam_code character varying(20) NOT NULL,
    mapped_exam_code character varying(20) NOT NULL
);


ALTER TABLE public.mapped_exams OWNER TO myuser;

--
-- Name: mapped_exams_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
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
-- Name: mapped_exams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.mapped_exams_id_seq OWNED BY public.mapped_exams.id;


--
-- Name: partner_institution; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.partner_institution (
    id integer NOT NULL,
    id_institution integer NOT NULL,
    id_partner_institution integer NOT NULL
);


ALTER TABLE public.partner_institution OWNER TO myuser;

--
-- Name: partner_institution_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
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
-- Name: partner_institution_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.partner_institution_id_seq OWNED BY public.partner_institution.id;


--
-- Name: uploaded_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.uploaded_documents (
    id integer NOT NULL,
    document_type character varying(50) NOT NULL,
    file_path character varying(255) NOT NULL,
    user_id integer NOT NULL,
    application_id integer NOT NULL
);


ALTER TABLE public.uploaded_documents OWNER TO myuser;

--
-- Name: uploaded_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
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
-- Name: uploaded_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.uploaded_documents_id_seq OWNED BY public.uploaded_documents.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    firstname character varying(255) NOT NULL,
    lastname character varying(255) NOT NULL,
    id_institution integer NOT NULL
);


ALTER TABLE public.users OWNER TO myuser;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
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
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: applications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications ALTER COLUMN id SET DEFAULT nextval('public.applications_id_seq'::regclass);


--
-- Name: institutions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.institutions ALTER COLUMN id SET DEFAULT nextval('public.institutions_id_seq'::regclass);


--
-- Name: mapped_exams id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mapped_exams ALTER COLUMN id SET DEFAULT nextval('public.mapped_exams_id_seq'::regclass);


--
-- Name: partner_institution id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partner_institution ALTER COLUMN id SET DEFAULT nextval('public.partner_institution_id_seq'::regclass);


--
-- Name: uploaded_documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uploaded_documents ALTER COLUMN id SET DEFAULT nextval('public.uploaded_documents_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: applications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.applications (id, year, semester, status, date_submitted, sending_institution, host_institution, user_id) FROM stdin;
\.


--
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exams (code, name, id_institution, credits) FROM stdin;
\.


--
-- Data for Name: institutions; Type: TABLE DATA; Schema: public; Owner: postgres
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
-- Data for Name: mapped_exams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.mapped_exams (id, application_id, exam_code, mapped_exam_code) FROM stdin;
\.


--
-- Data for Name: partner_institution; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.partner_institution (id, id_institution, id_partner_institution) FROM stdin;
\.


--
-- Data for Name: uploaded_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.uploaded_documents (id, document_type, file_path, user_id, application_id) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password_hash, role, firstname, lastname, id_institution) FROM stdin;
1	marco.rossi@stud.uni.com	a3f8c2d1e9b74056	student	Marco	Rossi	1
2	giulia.ferrari@stud.uni.com	b7d4e1a2f3c89012	student	Giulia	Ferrari	1
3	luca.bianchi@stud.uni.com	c1e5f9b3d2a74168	student	Luca	Bianchi	1
4	sofia.romano@stud.uni.com	d9a2b6c4e1f38290	student	Sofia	Romano	1
5	matteo.conti@stud.uni.com	e4f7a1b8c3d25019	student	Matteo	Conti	1
6	elena.ricci@stud.uni.com	f2b9c5d7e4a13087	student	Elena	Ricci	1
7	davide.marino@stud.uni.com	a8c3e6f1b9d24705	student	Davide	Marino	1
8	chiara.greco@stud.uni.com	b5d1f4a7c2e39816	student	Chiara	Greco	1
9	andrea.bruno@stud.uni.com	c6e2b8d9f1a45073	student	Andrea	Bruno	1
10	valentina.gallo@stud.uni.com	d1f5c3a8b7e29640	student	Valentina	Gallo	1
11	pierre.martin@stud.uni.com	e7a4d2c9f6b18305	student	Pierre	Martin	2
12	camille.durand@stud.uni.com	f3b8e1a5d4c27096	student	Camille	Durand	2
13	hans.mueller@stud.uni.com	a9c6f2b1e8d35704	student	Hans	Mueller	3
14	anna.schmidt@stud.uni.com	b2d7a3c5f9e41068	student	Anna	Schmidt	3
15	james.smith@stud.uni.com	c8e4b6d1a2f57390	student	James	Smith	4
16	emily.jones@stud.uni.com	d5f1c9b4e7a28031	student	Emily	Jones	4
17	lars.janssen@stud.uni.com	e1a8d5c7f3b69042	student	Lars	Janssen	5
18	sophie.vandenberg@stud.uni.com	f6b3e9a2d8c14057	student	Sophie	Vandenberg	5
19	felix.keller@stud.uni.com	a4c7f1b5e2d98036	student	Felix	Keller	6
20	nina.brunner@stud.uni.com	b8d2a9c6f4e15073	student	Nina	Brunner	6
21	carlos.garcia@stud.uni.com	c3e6b1d4a7f28950	student	Carlos	Garcia	7
22	lucia.fernandez@stud.uni.com	d7f4c2b9e5a31086	student	Lucia	Fernandez	7
23	piotr.kowalski@stud.uni.com	e2a5d8c1f7b46039	student	Piotr	Kowalski	8
24	katarzyna.nowak@stud.uni.com	f9b6e3a4d2c57018	student	Katarzyna	Nowak	8
25	jan.novak@stud.uni.com	a5c1f8b3e9d24706	student	Jan	Novak	9
26	petra.dvorak@stud.uni.com	b1d4a6c2f5e78093	student	Petra	Dvorak	9
27	pieter.desmet@stud.uni.com	c7e9b2d5a1f36084	student	Pieter	Desmet	10
28	elien.claes@stud.uni.com	d4f2c8b7e3a19065	student	Elien	Claes	10
29	stefan.huber@stud.uni.com	e8a1d3c9f2b54070	student	Stefan	Huber	11
30	lisa.wagner@stud.uni.com	f5b7e4a6d1c28039	student	Lisa	Wagner	11
31	mikko.virtanen@stud.uni.com	a2c8f5b4e7d31096	student	Mikko	Virtanen	12
32	aino.makinen@stud.uni.com	b6d3a1c9f8e24057	student	Aino	Makinen	12
33	erik.lindqvist@stud.uni.com	c4e7b5d2a9f16083	student	Erik	Lindqvist	13
34	maja.johansson@stud.uni.com	d8f1c4b6e2a37059	student	Maja	Johansson	13
35	rasmus.nielsen@stud.uni.com	e3a6d9c2f5b18074	student	Rasmus	Nielsen	14
36	ida.andersen@stud.uni.com	f7b4e2a8d3c59061	student	Ida	Andersen	14
37	olav.berg@stud.uni.com	a1c5f7b9e4d26083	student	Olav	Berg	15
38	ingrid.hansen@stud.uni.com	b9d6a2c4f1e37058	student	Ingrid	Hansen	15
39	joao.silva@stud.uni.com	c2e4b7d9a5f18096	student	João	Silva	16
40	ana.costa@stud.uni.com	d6f9c1b3e8a24075	student	Ana	Costa	16
41	nikos.papadopoulos@stud.uni.com	e5a3d7c8f2b49061	student	Nikos	Papadopoulos	17
42	eleni.georgiou@stud.uni.com	f1b8e5a9d4c37062	student	Eleni	Georgiou	17
43	balazs.nagy@stud.uni.com	a7c2f4b6e1d58093	student	Balázs	Nagy	18
44	reka.kovacs@stud.uni.com	b3d9a5c1f7e24068	student	Réka	Kovács	18
45	andrei.popescu@stud.uni.com	c9e1b4d6a2f37085	student	Andrei	Popescu	19
46	ioana.ionescu@stud.uni.com	d2f6c9b1e5a48073	student	Ioana	Ionescu	19
47	luka.horvat@stud.uni.com	e6a4d1c7f9b25068	student	Luka	Horvat	20
48	ana.maric@stud.uni.com	f8b2e7a3d6c14059	student	Ana	Marić	20
49	giovanni.ferrari@prof.uni.com	a3b7c1d9e5f28046	referent	Giovanni	Ferrari	1
50	laura.bianchi@prof.uni.com	b8d4a6c2f1e37059	referent	Laura	Bianchi	1
51	carlo.rossi@prof.uni.com	c2e9b5d3a7f14068	referent	Carlo	Rossi	1
52	jean.dupont@prof.uni.com	d7f1c4b8e2a39075	referent	Jean	Dupont	2
53	marie.leroy@prof.uni.com	e4a8d6c1f5b27083	referent	Marie	Leroy	2
54	thomas.bauer@prof.uni.com	f1b5e3a9d8c46072	referent	Thomas	Bauer	3
55	julia.richter@prof.uni.com	a6c3f9b2e4d15089	referent	Julia	Richter	3
56	william.taylor@prof.uni.com	b4d8a1c7f6e23096	referent	William	Taylor	4
57	sarah.wright@prof.uni.com	c9e5b3d2a8f17064	referent	Sarah	Wright	4
58	jan.dekker@prof.uni.com	d3f7c6b4e9a28051	referent	Jan	Dekker	5
59	maria.berg@prof.uni.com	e8a2d4c9f1b35078	referent	Maria	Berg	6
60	pedro.alves@prof.uni.com	f5b9e1a6d3c48067	referent	Pedro	Alves	7
61	agnieszka.wisniewska@prof.uni.com	a1c6f3b8e7d24095	referent	Agnieszka	Wiśniewska	8
62	tomas.blazek@prof.uni.com	b7d2a9c5f4e31082	referent	Tomáš	Blažek	9
63	inge.willems@prof.uni.com	c5e8b1d7a3f26079	referent	Inge	Willems	10
64	markus.gruber@prof.uni.com	d2f4c7b9e5a18066	referent	Markus	Gruber	11
65	sari.heikkinen@prof.uni.com	e9a3d5c8f2b47053	referent	Sari	Heikkinen	12
66	anders.svensson@prof.uni.com	f6b1e8a4d9c35072	referent	Anders	Svensson	13
67	anne.christensen@prof.uni.com	a4c9f2b7e1d58069	referent	Anne	Christensen	14
68	kari.olsen@prof.uni.com	b2d5a8c3f9e16084	referent	Kari	Olsen	15
69	giuseppe.verdi@staff.uni.com	c8e1b6d4a2f37091	staff	Giuseppe	Verdi	1
70	anna.colombo@staff.uni.com	d5f3c9b1e7a24078	staff	Anna	Colombo	1
71	roberto.mancini@staff.uni.com	e1a7d2c6f4b59065	staff	Roberto	Mancini	1
72	claire.moreau@staff.uni.com	f9b4e6a1d3c28082	staff	Claire	Moreau	2
73	francois.simon@staff.uni.com	a6c2f8b5e9d14079	staff	François	Simon	2
74	klaus.zimmer@staff.uni.com	b3d7a4c1f6e35086	staff	Klaus	Zimmer	3
75	heike.fischer@staff.uni.com	c7e4b9d3a5f18093	staff	Heike	Fischer	3
76	oliver.brown@staff.uni.com	d1f8c5b2e4a37060	staff	Oliver	Brown	4
77	charlotte.davies@staff.uni.com	e5a9d1c7f3b24077	staff	Charlotte	Davies	4
78	emma.visser@staff.uni.com	f2b6e4a8d9c51084	staff	Emma	Visser	5
79	david.meier@staff.uni.com	a8c4f1b9e2d36071	staff	David	Meier	6
80	carmen.ruiz@staff.uni.com	b5d1a7c3f8e29068	staff	Carmen	Ruiz	7
81	marek.wojcik@staff.uni.com	c1e6b4d9a2f47085	staff	Marek	Wójcik	8
82	lenka.horakova@staff.uni.com	d9f3c8b5e1a24072	staff	Lenka	Horáková	9
83	thomas.claes@staff.uni.com	e4a1d6c2f9b38069	staff	Thomas	Claes	10
84	monika.fischer@staff.uni.com	f7b9e2a5d4c16086	staff	Monika	Fischer	11
85	paivi.leinonen@staff.uni.com	a2c8f6b1e3d57073	staff	Päivi	Leinonen	12
86	per.nilsson@staff.uni.com	b6d3a9c4f1e28090	staff	Per	Nilsson	13
87	mette.larsen@staff.uni.com	c4e7b2d8a6f35077	staff	Mette	Larsen	14
88	sigrid.dahl@staff.uni.com	d8f5c1b3e9a47064	staff	Sigrid	Dahl	15
89	rui.ferreira@staff.uni.com	e3a6d9c5f2b18081	staff	Rui	Ferreira	16
90	stavros.alexiou@staff.uni.com	f1b4e7a2d8c36078	staff	Stavros	Alexiou	17
91	zoltan.fekete@staff.uni.com	a9c5f3b7e4d21095	staff	Zoltán	Fekete	18
92	mihai.dinu@staff.uni.com	b1d8a2c9f6e47082	staff	Mihai	Dinu	19
93	tomislav.babic@staff.uni.com	c6e3b5d1a8f24079	staff	Tomislav	Babić	20
94	katia.lombardi@staff.uni.com	d4f9c2b6e3a51086	staff	Katia	Lombardi	16
95	nuno.santos@staff.uni.com	e7a1d4c8f5b38073	staff	Nuno	Santos	17
96	george.pappas@staff.uni.com	f3b6e9a4d2c17090	staff	George	Pappas	18
97	diana.stoica@staff.uni.com	a5c9f4b2e8d36077	staff	Diana	Stoica	19
98	ivana.petrovic@staff.uni.com	b8d2a6c3f1e59084	staff	Ivana	Petrović	20
\.


--
-- Name: applications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.applications_id_seq', 1, false);


--
-- Name: institutions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.institutions_id_seq', 1, false);


--
-- Name: mapped_exams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.mapped_exams_id_seq', 1, false);


--
-- Name: partner_institution_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.partner_institution_id_seq', 1, false);


--
-- Name: uploaded_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.uploaded_documents_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 98, true);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (code);


--
-- Name: institutions institutions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.institutions
    ADD CONSTRAINT institutions_pkey PRIMARY KEY (id);


--
-- Name: mapped_exams mapped_exams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mapped_exams
    ADD CONSTRAINT mapped_exams_pkey PRIMARY KEY (id);


--
-- Name: partner_institution partner_institution_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partner_institution
    ADD CONSTRAINT partner_institution_pkey PRIMARY KEY (id);


--
-- Name: uploaded_documents uploaded_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uploaded_documents
    ADD CONSTRAINT uploaded_documents_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: applications applications_host_institution_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_host_institution_fkey FOREIGN KEY (host_institution) REFERENCES public.institutions(id);


--
-- Name: applications applications_sending_institution_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_sending_institution_fkey FOREIGN KEY (sending_institution) REFERENCES public.institutions(id);


--
-- Name: applications applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: exams exams_id_institution_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_id_institution_fkey FOREIGN KEY (id_institution) REFERENCES public.institutions(id);


--
-- Name: mapped_exams mapped_exams_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mapped_exams
    ADD CONSTRAINT mapped_exams_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id);


--
-- Name: mapped_exams mapped_exams_exam_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mapped_exams
    ADD CONSTRAINT mapped_exams_exam_code_fkey FOREIGN KEY (exam_code) REFERENCES public.exams(code);


--
-- Name: mapped_exams mapped_exams_mapped_exam_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mapped_exams
    ADD CONSTRAINT mapped_exams_mapped_exam_code_fkey FOREIGN KEY (mapped_exam_code) REFERENCES public.exams(code);


--
-- Name: partner_institution partner_institution_id_institution_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partner_institution
    ADD CONSTRAINT partner_institution_id_institution_fkey FOREIGN KEY (id_institution) REFERENCES public.institutions(id);


--
-- Name: partner_institution partner_institution_id_partner_institution_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partner_institution
    ADD CONSTRAINT partner_institution_id_partner_institution_fkey FOREIGN KEY (id_partner_institution) REFERENCES public.institutions(id);


--
-- Name: uploaded_documents uploaded_documents_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uploaded_documents
    ADD CONSTRAINT uploaded_documents_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id);


--
-- Name: uploaded_documents uploaded_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uploaded_documents
    ADD CONSTRAINT uploaded_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_id_institution_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_institution_fkey FOREIGN KEY (id_institution) REFERENCES public.institutions(id);


--
-- PostgreSQL database dump complete
--

\unrestrict cDpeYIQswHUyul7hcIbNaDXa7aYfGbEdlMhWsuRpyCD5qgyUBEANUGMd4nL2C3a

