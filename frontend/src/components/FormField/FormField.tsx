import type { ReactNode } from "react";
import "./FormField.scss";

interface FormFieldProps {
  name: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

export function FormField({ name, label, required, error, children }: FormFieldProps) {
  return <div className={`form-field${error ? " form-field--error" : ""}`}>
    <label className="form-field__label" htmlFor={`animal-${name}`}>
      {label}{required && <span className="form-field__required" aria-hidden="true"> *</span>}
    </label>
    {children}
    {error && <p className="form-field__error" id={`animal-${name}-error`}>{error}</p>}
  </div>;
}
