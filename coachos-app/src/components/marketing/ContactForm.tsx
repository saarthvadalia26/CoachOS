"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const instituteSizes = [
  "Under 100 students",
  "100-500 students",
  "500-1,500 students",
  "1,500+ students",
  "Multiple branches",
];

export function ContactForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);

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
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setIsSubmitted(true);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Label>
          Full name
          <Input required name="fullName" placeholder="Your name" />
        </Label>
        <Label>
          Email
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
          Phone <span className="font-normal text-muted-foreground">(optional)</span>
          <Input name="phone" type="tel" placeholder="+91 98765 43210" />
        </Label>
        <Label>
          Institute size
          <select
            required
            name="instituteSize"
            defaultValue=""
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            <option value="" disabled>
              Select size
            </option>
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

      <Button type="submit" className="justify-self-start" variant="accent">
        <Send aria-hidden="true" data-icon="inline-start" />
        Send demo request
      </Button>
    </form>
  );
}
