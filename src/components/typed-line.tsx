"use client";
import { useEffect, useRef, useState } from "react";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const between = (min: number, max: number) => min + Math.random() * (max - min);

/** Inson yozganidek: tekis emas, so‘z boshida va tinish belgisidan keyin to‘xtab. */
function typingDelay(text: string, index: number) {
  const prev = text[index - 1] || "";
  const char = text[index];
  let delay = between(55, 125);
  if (char === " ") delay += between(30, 90);
  if (/[.,!?—:;«»]/.test(prev)) delay += between(180, 420);
  const wordStart = text.lastIndexOf(" ", index - 1) + 1;
  // «Ho… zir», «qo‘… lingiz» — so‘zning 2–3-harfidan keyin ba’zan o‘ylanib qoladi.
  if (index - wordStart >= 2 && index - wordStart <= 3 && Math.random() < 0.16) delay += between(180, 420);
  if (Math.random() < 0.04) delay += between(250, 600);
  return delay;
}

/**
 * Jumlalarni klaviaturada yozilayotgandek chiqaradi: yozadi, 5–6 soniya turadi,
 * inson kabi (o‘rtada bir to‘xtab) o‘chiradi va keyingisini yozadi.
 * `next` har safar chaqiriladi — jumla panelning joriy holatiga qarab tanlanadi.
 */
export function TypedLine({ next }: { next: (recent: string[]) => string }) {
  const [text, setText] = useState("");
  const [full, setFull] = useState("");
  const [typing, setTyping] = useState(false);
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  });

  useEffect(() => {
    let alive = true;
    const recent: string[] = [];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const choose = () => {
      const quote = nextRef.current(recent);
      recent.push(quote);
      if (recent.length > 20) recent.shift();
      setFull(quote);
      return quote;
    };
    (async () => {
      if (reduced) {
        // Harakat kamaytirilgan: yozish effekti yo‘q, jumla jimgina almashadi.
        while (alive) {
          setText(choose());
          await wait(7000);
        }
        return;
      }
      await wait(between(500, 900)); // sahifa ochilganda qator bir lahza bo‘sh turadi
      while (alive) {
        const quote = choose();
        setTyping(true);
        for (let i = 0; i < quote.length && alive; i++) {
          await wait(typingDelay(quote, i));
          setText(quote.slice(0, i + 1));
        }
        setTyping(false);
        await wait(between(5000, 6000));
        if (!alive) return;
        setTyping(true);
        const pauseAt = Math.floor(quote.length * between(0.35, 0.65));
        for (let i = quote.length - 1; i >= 0 && alive; i--) {
          await wait(i === pauseAt ? between(260, 560) : between(28, 62));
          setText(quote.slice(0, i));
        }
        setTyping(false);
        await wait(between(420, 820));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <span className="typed">
      <span aria-hidden="true">
        {text}
        <span className={`typed-caret ${typing ? "is-typing" : ""}`} />
      </span>
      <span className="sr-only">{full}</span>
    </span>
  );
}
