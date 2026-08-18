drop trigger meetings_enforce_edit_phase on public.meetings;
create trigger meetings_workflow_edit_phase
before update on public.meetings
for each row execute function private.enforce_meeting_edit_phase();
