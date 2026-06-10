"use client";

import { CheckCircle2, Send } from "lucide-react";
import {
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const formspreeEndpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT ?? "";

const instituteSizes = [
  "Under 100 students",
  "100-500 students",
  "500-1,500 students",
  "1,500+ students",
  "Multiple branches",
];

const requiredFieldMessages = {
  email: "Enter a valid work email.",
  fullName: "Enter your full name.",
  instituteName: "Enter your institute name.",
  message: "Tell us how we can help.",
} as const;

const requiredFieldNames = [
  "fullName",
  "email",
  "instituteName",
  "message",
] as const;

type RequiredFieldName = (typeof requiredFieldNames)[number];
type FieldErrors = Partial<Record<RequiredFieldName, string>>;

function getRequiredValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function isRequiredField(name: string): name is RequiredFieldName {
  return requiredFieldNames.includes(name as RequiredFieldName);
}

function validateField(name: RequiredFieldName, value: string) {
  if (!value.trim()) {
    return requiredFieldMessages[name];
  }

  if (
    name === "email" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  ) {
    return requiredFieldMessages.email;
  }

  return null;
}

function validateContactForm(formData: FormData) {
  const errors: FieldErrors = {};

  for (const fieldName of requiredFieldNames) {
    const error = validateField(fieldName, getRequiredValue(formData, fieldName));

    if (error) {
      errors[fieldName] = error;
    }
  }

  return errors;
}

function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

export function ContactForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touchedFields, setTouchedFields] = useState<
    Partial<Record<RequiredFieldName, boolean>>
  >({});

  function getVisibleError(fieldName: RequiredFieldName) {
    if (!hasAttemptedSubmit && !touchedFields[fieldName]) {
      return undefined;
    }

    return fieldErrors[fieldName];
  }

  function getFieldClass(fieldName: RequiredFieldName) {
    return cn(
      getVisibleError(fieldName) &&
        "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
    );
  }

  function setSingleFieldError(fieldName: RequiredFieldName, value: string) {
    const error = validateField(fieldName, value);

    setFieldErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };

      if (error) {
        nextErrors[fieldName] = error;
      } else {
        delete nextErrors[fieldName];
      }

      return nextErrors;
    });
  }

  function handleFieldBlur(
    event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const fieldName = event.currentTarget.name;

    if (!isRequiredField(fieldName)) {
      return;
    }

    setTouchedFields((currentFields) => ({
      ...currentFields,
      [fieldName]: true,
    }));
    setSingleFieldError(fieldName, event.currentTarget.value);
  }

  function handleFieldChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const fieldName = event.currentTarget.name;

    if (
      !isRequiredField(fieldName) ||
      (!hasAttemptedSubmit && !touchedFields[fieldName])
    ) {
      return;
    }

    setSingleFieldError(fieldName, event.currentTarget.value);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setHasAttemptedSubmit(true);

    const formData = new FormData(event.currentTarget);
    const fullName = getRequiredValue(formData, "fullName");
    const email = getRequiredValue(formData, "email");
    const instituteName = getRequiredValue(formData, "instituteName");
    const phoneNumber = getRequiredValue(formData, "phoneNumber");
    const instituteSize = getRequiredValue(formData, "instituteSize");
    const message = getRequiredValue(formData, "message");
    const nextFieldErrors = validateContactForm(formData);

    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length) {
      setErrorMessage("Please review the highlighted fields.");
      return;
    }

    if (!formspreeEndpoint) {
      setErrorMessage(
        "The contact form is not configured yet. Please try again later.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(formspreeEndpoint, {
        body: JSON.stringify({
          email,
          full_name: fullName,
          institute_name: instituteName,
          institute_size: instituteSize,
          message,
          phone_number: phoneNumber,
          source: "CoachOS contact page",
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Formspree request failed.");
      }

      setIsSubmitted(true);
    } catch {
      setErrorMessage("Your request could not be submitted. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-6 text-sm text-foreground">
        <div className="flex items-start gap-3">
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 size-5 text-emerald-600"
          />
          <div>
            <h2 className="text-lg font-semibold">
              Thank you. We&apos;ll contact you shortly.
            </h2>
            <p className="mt-2 leading-6 text-muted-foreground">
              We have received your request and will follow up with next steps
              for a CoachOS walkthrough.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
      {errorMessage ? (
        <p
          aria-live="polite"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Label>
          Full name
          <Input
            name="fullName"
            placeholder="Your name"
            autoComplete="name"
            aria-invalid={Boolean(getVisibleError("fullName"))}
            aria-describedby={
              getVisibleError("fullName") ? "fullName-error" : undefined
            }
            className={getFieldClass("fullName")}
            onBlur={handleFieldBlur}
            onChange={handleFieldChange}
          />
          <FieldError
            id="fullName-error"
            message={getVisibleError("fullName")}
          />
        </Label>
        <Label>
          Work email
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@institute.com"
            aria-invalid={Boolean(getVisibleError("email"))}
            aria-describedby={
              getVisibleError("email") ? "email-error" : undefined
            }
            className={getFieldClass("email")}
            onBlur={handleFieldBlur}
            onChange={handleFieldChange}
          />
          <FieldError id="email-error" message={getVisibleError("email")} />
        </Label>
      </div>

      <Label>
        Institute name
        <Input
          name="instituteName"
          placeholder="Your coaching institute"
          aria-invalid={Boolean(getVisibleError("instituteName"))}
          aria-describedby={
            getVisibleError("instituteName")
              ? "instituteName-error"
              : undefined
          }
          className={getFieldClass("instituteName")}
          onBlur={handleFieldBlur}
          onChange={handleFieldChange}
        />
        <FieldError
          id="instituteName-error"
          message={getVisibleError("instituteName")}
        />
      </Label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Label>
          <span>
            Phone{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </span>
          <Input name="phoneNumber" type="tel" placeholder="+91 98765 43210" />
        </Label>
        <Label>
          Institute size
          <select
            name="instituteSize"
            defaultValue=""
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            <option value="">Select size</option>
            {instituteSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </Label>
      </div>

      <Label>
        Message
        <textarea
          name="message"
          rows={5}
          placeholder="Tell us about your branches, batches, and current operations."
          aria-invalid={Boolean(getVisibleError("message"))}
          aria-describedby={
            getVisibleError("message") ? "message-error" : undefined
          }
          className={cn(
            "min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
            getFieldClass("message"),
          )}
          onBlur={handleFieldBlur}
          onChange={handleFieldChange}
        />
        <FieldError
          id="message-error"
          message={getVisibleError("message")}
        />
      </Label>

      <Button
        type="submit"
        className="justify-self-start"
        variant="accent"
        disabled={isSubmitting}
      >
        <Send aria-hidden="true" data-icon="inline-start" />
        {isSubmitting ? "Submitting..." : "Send demo request"}
      </Button>
    </form>
  );
}
