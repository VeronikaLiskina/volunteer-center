import { useState, type InputHTMLAttributes } from "react";
import { formatDate } from "../../utils/date";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value"> & { value: string };

function toISO(value: string): string {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return "";
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00`);
  return date.getFullYear() === +year && date.getMonth() + 1 === +month && date.getDate() === +day ? iso : "";
}

// A text field makes the displayed format independent of the browser locale.
export function DateInput({ value, onChange, ...props }: Props) {
  const [draft, setDraft] = useState<{ text: string; iso: string } | null>(null);
  const text = draft?.iso === value ? draft.text : value ? formatDate(value) : "";
  return <input {...props} type="text" inputMode="numeric" placeholder="ДД.ММ.ГГГГ" value={text}
    maxLength={10} pattern="[0-9]{2}\.[0-9]{2}\.[0-9]{4}"
    onChange={(event) => {
      const entered = event.currentTarget.value;
      const iso = toISO(entered);
      setDraft({ text: entered, iso });
      event.currentTarget.value = iso;
      onChange?.(event);
      event.currentTarget.value = entered;
    }} />;
}
