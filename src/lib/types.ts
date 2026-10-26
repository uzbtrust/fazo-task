export type Role = "admin" | "creator" | "designer";
export type TaskStatus =
  "open" | "in_progress" | "in_review" | "approved" | "completed" | "cancelled";
export type Priority = "low" | "medium" | "high";
export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
  active: boolean;
  createdAt: string;
}
export interface Attachment {
  id: string;
  name: string;
  size: number;
  mime: string;
  url: string;
}
export interface TaskComment {
  id: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: string;
}
export interface Activity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  message: string;
  createdAt: string;
}
export interface Task {
  id: string;
  number: number;
  title: string;
  description: string;
  priority: Priority;
  category: string;
  dueDate: string | null;
  status: TaskStatus;
  creatorId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  submissionText: string;
  deliveryAttachments: Attachment[];
  comments: TaskComment[];
  activity: Activity[];
}
