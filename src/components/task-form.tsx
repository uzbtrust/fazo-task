"use client";
import { FormEvent, useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { FileMeta, Priority, Task } from "@/lib/types";
import { api, ErrorMessage, Modal, Spinner, StarPicker } from "./ui";
import { Attachments, FileDrop, LinkAdder, LinkCards, useUploader } from "./files";
import { DatePicker } from "./date-picker";

export function TaskForm({
  task,
  onClose,
  onSaved,
}: {
  task?: Task;
  onClose: () => void;
  onSaved: (task: Task) => void;
}) {
  const formId = useId();
  const countId = useId();
  const [title, setTitle] = useState(task?.title || "");
  const [brief, setBrief] = useState(task?.brief || "");
  const [imageCount, setImageCount] = useState(task ? String(task.imageCount) : "");
  const [dueDate, setDueDate] = useState(task?.dueDate || "");
  const [priority, setPriority] = useState<Priority | null>(task?.priority ?? null);
  const [kept, setKept] = useState<FileMeta[]>(task?.briefFiles || []);
  const [added, setAdded] = useState<FileMeta[]>([]);
  const [keptRefs, setKeptRefs] = useState<FileMeta[]>(task?.referenceFiles || []);
  const [addedRefs, setAddedRefs] = useState<FileMeta[]>([]);
  const [links, setLinks] = useState<string[]>(task?.links.map((l) => l.url) || []);
  const uploader = useUploader();
  const refUploader = useUploader();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const count = Number(imageCount);
  const files = [...kept, ...added];
  const references = [...keptRefs, ...addedRefs];
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!brief.trim() && !files.length) {
      setError("TZ ni matn bilan yozing yoki fayl yuklang.");
      return;
    }
    setBusy(true);
    try {
      const fields = {
        title,
        brief,
        imageCount: count,
        priority,
        dueDate: dueDate || null,
        fileIds: added.map((f) => f.id),
        referenceIds: addedRefs.map((f) => f.id),
        links,
      };
      const data = await api<{ task: Task }>(task ? `/api/tasks/${task.id}` : "/api/tasks", {
        method: task ? "PATCH" : "POST",
        body: JSON.stringify(
          task
            ? {
                action: "edit",
                ...fields,
                removeFileIds: [
                  ...task.briefFiles.filter((f) => !kept.includes(f)),
                  ...task.referenceFiles.filter((f) => !keptRefs.includes(f)),
                ].map((f) => f.id),
              }
            : fields,
        ),
      });
      onSaved(data.task);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={task ? "Vazifani tahrirlash" : "Yangi vazifa"}
      eyebrow={task ? `Vazifa · #${String(task.number).padStart(3, "0")}` : "Ochiq vazifalarga qo‘yiladi"}
      onClose={onClose}
    >
      <form id={formId} className="sheet-body form" onSubmit={save}>
        <label className="field">
          <span className="field-label">Vazifa nomi</span>
          <input
            className="input input-lg"
            placeholder="Masalan, kuzgi kolleksiya uchun karusel"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={160}
          />
        </label>
        <div className="field">
          <span className="field-label">
            TZ <span className="optional">matn yoki fayl — kamida bittasi</span>
          </span>
          <textarea
            className="input"
            rows={5}
            aria-label="TZ matni"
            placeholder="Nima kerak: o‘lcham, uslub, matnlar, ranglar, havolalar…"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            maxLength={20000}
          />
          <FileDrop
            busy={uploader.busy}
            title="TZ faylini yuklash"
            hint="PDF, Word, rasm yoki dizayn fayli · 4 MB gacha · sudrab tashlash mumkin"
            onFiles={(list) => uploader.upload(list, (file) => setAdded((prev) => [...prev, file]))}
          />
          <ErrorMessage message={uploader.error} />
          <Attachments
            files={files}
            canRemove={() => true}
            onRemove={(file) => {
              setKept((prev) => prev.filter((f) => f.id !== file.id));
              setAdded((prev) => prev.filter((f) => f.id !== file.id));
            }}
          />
        </div>
        <div className="field">
          <span className="field-label">
            Referenslar <span className="optional">ixtiyoriy · namuna rasmlar va havolalar</span>
          </span>
          <div className="reference-box">
            <FileDrop
              busy={refUploader.busy}
              imagesOnly
              title="Namuna rasm qo‘shish"
              hint="Qanday uslub kerakligini ko‘rsating · 4 MB gacha"
              onFiles={(list) => refUploader.upload(list, (file) => setAddedRefs((prev) => [...prev, file]))}
            />
            <ErrorMessage message={refUploader.error} />
            <Attachments
              files={references}
              layout="board"
              canRemove={() => true}
              onRemove={(file) => {
                setKeptRefs((prev) => prev.filter((f) => f.id !== file.id));
                setAddedRefs((prev) => prev.filter((f) => f.id !== file.id));
              }}
            />
            <LinkAdder
              onAdd={(url) => {
                if (links.includes(url)) return "Bu havola allaqachon qo‘shilgan.";
                if (links.length >= 20) return "Ko‘pi bilan 20 ta havola.";
                setLinks((prev) => [...prev, url]);
                return null;
              }}
            />
            <LinkCards links={links.map((url) => ({ url }))} onRemove={(url) => setLinks((prev) => prev.filter((l) => l !== url))} />
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor={countId}>
            Nechta rasm kerak
          </label>
          <div className="stepper">
            <button
              type="button"
              aria-label="Kamaytirish"
              disabled={!count || count <= 1}
              onClick={() => setImageCount(String(Math.max(1, count - 1)))}
            >
              <Minus size={16} strokeWidth={2.2} />
            </button>
            <input
              id={countId}
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              placeholder="—"
              value={imageCount}
              onChange={(e) => setImageCount(e.target.value)}
              required
            />
            <button
              type="button"
              aria-label="Ko‘paytirish"
              disabled={count >= 100}
              onClick={() => setImageCount(String(Math.min(100, (count || 0) + 1)))}
            >
              <Plus size={16} strokeWidth={2.2} />
            </button>
            <span className="stepper-unit">ta rasm</span>
          </div>
        </div>
        <div className="field">
          <span className="field-label">
            Muddat <span className="optional">ixtiyoriy</span>
          </span>
          <DatePicker label="Muddat" value={dueDate} onChange={setDueDate} />
        </div>
        <div className="field">
          <span className="field-label">
            Muhimlik <span className="optional">ixtiyoriy</span>
          </span>
          <StarPicker value={priority} onChange={setPriority} />
        </div>
        <ErrorMessage message={error} />
      </form>
      <div className="sheet-foot">
        <button type="button" className="btn btn-quiet" onClick={onClose}>
          Bekor qilish
        </button>
        <button
          type="submit"
          form={formId}
          className="btn btn-primary"
          disabled={busy || uploader.busy || refUploader.busy || !title.trim() || !count}
        >
          {busy ? <Spinner label="Saqlanmoqda" /> : task ? "Saqlash" : "Vazifani qo‘yish"}
        </button>
      </div>
    </Modal>
  );
}
