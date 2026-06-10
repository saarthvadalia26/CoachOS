"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formspreeEndpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT ?? "";

const instituteSizes = [
  "Under 100 students",
  "100-500 students",
  "500-1,500 students",
  "1,500+ students",
  "Multiple branches",
];

function getRequiredValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function ContactForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);

    if (!formspreeEndpoint) {
      setErrorMessage(
        "The contact form is not configured yet. Please try again later.",
      );
      return;
    }

    const formData = new FormData(event.currentTarget);
    const fullName = getRequiredValue(formData, "fullName");
    const email = getRequiredValue(formData, "email");
    const instituteName = getRequiredValue(formData, "instituteName");
    const phoneNumber = getRequiredValue(formData, "phoneNumber");
    const instituteSize = getRequiredValue(formData, "instituteSize");
    const message = getRequiredValue(formData, "message");

    if (!fullName || !email || !instituteName || !message) {
      setErrorMessage("Please complete all required fields.");
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
    <form className="grid gap-4" onSubmit={handleSubmit}>
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
          <Input required name="fullName" placeholder="Your name" />
        </Label>
        <Label>
          Work email
          <Input
            required
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@institute.com"
          />
        </Label>
      </div>

      <Label>
        Institute name
        <Input
          required
          name="instituteName"
          placeholder="Your coaching institute"
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
          required
          name="message"
          rows={5}
          placeholder="Tell us about your branches, batches, and current operations."
          className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
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
