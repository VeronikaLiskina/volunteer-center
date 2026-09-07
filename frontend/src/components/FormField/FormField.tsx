import type { ReactNode } from "react";
import "./FormField.scss";

interface FormFieldProps {
  name: string;
  label: string;
  idPrefix?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

export function FormField({ name, label, idPrefix = "animal", required, error, children }: FormFieldProps) {
  return <div className={`form-field${error ? " form-field--error" : ""}`}>
    <label className="form-field__label" htmlFor={`${idPrefix}-${name}`}>
      {label}{required && <span className="form-field__required" aria-hidden="true"> *</span>}
    </label>
    {children}
    {error && <p className="form-field__error" id={`${idPrefix}-${name}-error`}>{error}</p>}
  </div>;
}
