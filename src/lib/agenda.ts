export type AgendaDraftItem = {
  id?: string;
  title: string;
  assigneeIds: string[];
};

export type AgendaPerson = {
  id: string;
  full_name: string;
};
