/** Yangi kasb qo‘shilganda shu yerga va lib/roles.ts ga qo‘shiladi. */
export type Role = "admin" | "pm" | "designer";
export type TaskStatus = "todo" | "in_progress" | "in_review" | "done" | "cancelled";
export type Priority = 1 | 2 | 3 | 4 | 5;
export type FileKind = "brief" | "result";

export interface Account {
  id: string;
  name: string;
  username: string;
  role: Role;
  createdAt: string;
}
export interface MemberStats {
  inProgress: number;
  inReview: number;
  done: number;
  overdue: number;
  created: number;
}
export interface Member {
  id: string;
  name: string;
  username: string;
  role: Role;
  activated: boolean;
  createdAt: string;
  activatedAt: string | null;
  stats: MemberStats;
}
export interface FileMeta {
  id: string;
  kind: FileKind;
  name: string;
  size: number;
  mime: string;
  ownerId: string;
  url: string;
}
export interface TaskEvent {
  id: string;
  memberId: string;
  memberName: string;
  action: string;
  message: string;
  createdAt: string;
}
export interface Task {
  id: string;
  number: number;
  title: string;
  brief: string;
  imageCount: number;
  priority: Priority | null;
  dueDate: string | null;
  status: TaskStatus;
  /** null — ochiq vazifa, hali hech kim olmagan. */
  assigneeId: string | null;
  assigneeName: string | null;
  createdBy: string;
  creatorName: string;
  resultNote: string;
  createdAt: string;
  updatedAt: string;
  claimedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  briefFiles: FileMeta[];
  resultFiles: FileMeta[];
  events: TaskEvent[];
}

export interface StatsRow {
  id: string;
  name: string;
  role: Role;
  /** Dizayner: qabul qilingan vazifalar va ulardagi rasmlar. */
  done: number;
  images: number;
  onTime: number;
  late: number;
  noDeadline: number;
  returns: number;
  inProgress: number;
  inReview: number;
  /** Olishdan topshirishgacha o‘rtacha soat (qabul qilinganlar bo‘yicha). */
  avgHours: number | null;
  /** PM: bergan, qabul qilgan va qaytargan vazifalari. */
  created: number;
  accepted: number;
}
export interface Stats {
  period: "7" | "30" | "all";
  totals: {
    created: number;
    open: number;
    inProgress: number;
    inReview: number;
    done: number;
    images: number;
    onTime: number;
    late: number;
  };
  designers: StatsRow[];
  managers: StatsRow[];
}
