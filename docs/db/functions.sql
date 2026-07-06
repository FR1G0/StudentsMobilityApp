-- update the status of an application based on infered data
create or replace function update_application_status(idA INT) returns boolean as $$
begin 
	-- is document uploaded
	if not exists(select * from uploaded_documents where application_id=idA and document_type='learning_agreement') then 
		update applications set status='learning_agreement_pending' where id = idA;
	end if;
	return true;
end
$$ language plpgsql;


