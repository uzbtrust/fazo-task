export type TaskStatus = "todo" | "in_progress" | "done";
export type Priority = 1 | 2 | 3;
export interface Account {
  id: string;
  name: string;
  username: string;
  createdAt: string;
}
export interface Employee {
  id: string;
  name: string;
  position: string;
  createdAt: string;
}
export interface Task {
  id: string;
  number: number;
  title: string;
  description: string;
  priority: Priority;
  dueDate: string | null;
  status: TaskStatus;
  assigneeId: string;
  assigneeName: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
