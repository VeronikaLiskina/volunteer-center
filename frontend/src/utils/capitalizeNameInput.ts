export function capitalizeNameInput(input: HTMLInputElement): string {
  const { selectionStart, selectionEnd, selectionDirection } = input;
  const capitalize = (value: string) => value.replace(/(^|[\s-])\p{L}/gu, (match) => match.toUpperCase());
  const value = input.value;
  const capitalized = capitalize(value);

  if (capitalized !== value) {
    input.value = capitalized;
    // Keep the cursor in place when correcting a name in the middle of the field.
    if (selectionStart !== null && selectionEnd !== null) {
      input.setSelectionRange(
        capitalize(value.slice(0, selectionStart)).length,
        capitalize(value.slice(0, selectionEnd)).length,
        selectionDirection ?? undefined,
      );
    }
  }
  return capitalized;
}
