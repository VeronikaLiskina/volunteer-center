import { useLayoutEffect, useRef, type InputHTMLAttributes } from "react";
import { formatPhone } from "../../utils/phone";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value"> & { value: string };

export function PhoneInput({ value, onChange, onKeyDown, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caret.current !== null) input.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });
  return <input {...props} ref={input} type="tel" inputMode="tel" value={formatPhone(value)}
    onKeyDown={(event) => {
      onKeyDown?.(event);
      const element = event.currentTarget;
      const position = element.selectionStart ?? 0;
      if (event.key === "Backspace" && position === element.selectionEnd && position > 0
          && /\D/.test(element.value[position - 1])) {
        let start = position - 1;
        while (start > 0 && /\D/.test(element.value[start])) start--;
        element.setSelectionRange(start, position);
      }
    }}
    onChange={(event) => {
      const element = event.currentTarget;
      const digitCount = element.value.slice(0, element.selectionStart ?? element.value.length).replace(/\D/g, "").length;
      const formatted = formatPhone(element.value);
      let position = 0;
      let count = 0;
      while (position < formatted.length && count < digitCount) {
        if (/\d/.test(formatted[position])) count++;
        position++;
      }
      // Typing without a country prefix inserts +7 before the entered digits.
      if (element.value && !/^[+78]/.test(element.value)) position = formatted.length;
      element.value = formatted;
      caret.current = position;
      onChange?.(event);
    }} />;
}
