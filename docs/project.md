# Project Requirements
----------------------
	- auto populate the database on containerized db


# Entities & Permissions
----------------------
## Student
    - List of created Mobility Applications
        - Applicaiton Preview
            - with the ability view or add modifications
			- upload
		- upload transcript of records
    - Application Creation View
        - confirm creation (preview the document in a separate view then confirm)

## Lecturer 
    - List of exisitng Mobile Applications assigned to that specific lecturer
        - Application Preview
            - show information (form input & uploaded file)
            - show exam mappings
			- approve or reject + reason
		- approve transcript of records
	- Add can exams for its own institution

## Overseas Staff 
    - All applicantions (host institution, guest institution, assigned applicaiton)
    - Applicaiton Preview 
		- set pre-departure phase (complete only if approved by lecturer)
        - can complete or close
		- close application after transcript of records is uploaded
	- Ability to add new partner Institution (extra)
	- Ability to remove partner Instution, + keep applications history? (extra)


# Frontend Views & capabilities
----------------------
## Dashboard (top-level)
    - sidebar with entries fetched from the db based on role
    - topbar for quick access to other stuff

## Authentication
    - login using JWT

## Application Creation
### Students
	- form information
	- exam mappings

## Application Preview
### Students & Referents
    - show information about application
    - show the mapping between exams
    - show the uploaded documents


# Database
----------------------
## Istitutions
	- is partnered with other institutions
	- has assigned lecturers
    - has assigned students
    - has assigned exams/lectures

## Partnership
    - between two institutions
    - has assigned applications
    - cannot be self-assigned
	
## Student
	- assigned to istitution
	- assigned to multiple applications

## Application
	- assigned student
	- partner & host institutions
    - stato
        - bozza / draft
        - attesa LA / waiting for LA
        - partenza / departure
        - in corso / in progress
        - riconoscimento esami / recognition
        - chiusa / closed
	- assigned lecturer
	- exam mappings

## Lecturer / Refernt
	- assigned to only one istitutions, a referent cannot work for two universities
