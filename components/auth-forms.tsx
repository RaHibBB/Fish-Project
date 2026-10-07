"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePinAction, loginAction, type FormState } from "@/app/login/actions";

const fieldClass = "h-14 text-xl tracking-wider";

/** Where to go after login / PIN change (from ?next=, set by the proxy). */
function NextField() {
  const next = useSearchParams().get("next");
  return next ? <input type="hidden" name="redirectTo" value={next} /> : null;
}

function FormError({ state }: { state: FormState }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
      {state.error}
    </p>
  );
}

function PinInput({ name, label, autoFocus }: { name: string; label: string; autoFocus?: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="text-base">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type="password"
        inputMode="numeric"
        autoComplete={name === "pin" || name === "current" ? "current-password" : "new-password"}
        pattern="[0-9০-৯]{6}"
        maxLength={6}
        required
        autoFocus={autoFocus}
        className={fieldClass}
      />
    </div>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-5">
      <NextField />
      <div className="space-y-2">
        <Label htmlFor="phone" className="text-base">
          ফোন নম্বর
        </Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="01XXXXXXXXX"
          required
          className={fieldClass}
        />
      </div>
      <PinInput name="pin" label="৬ সংখ্যার পিন" />
      <FormError state={state} />
      <Button type="submit" disabled={pending} className="h-14 w-full text-lg">
        {pending ? "অপেক্ষা করুন…" : "ঢুকুন"}
      </Button>
    </form>
  );
}

export function ChangePinForm() {
  const [state, action, pending] = useActionState(changePinAction, {});
  return (
    <form action={action} className="space-y-5">
      <NextField />
      <PinInput name="current" label="বর্তমান পিন" autoFocus />
      <PinInput name="next" label="নতুন পিন (৬ সংখ্যা)" />
      <PinInput name="confirm" label="নতুন পিন আবার দিন" />
      <FormError state={state} />
      <Button type="submit" disabled={pending} className="h-14 w-full text-lg">
        {pending ? "অপেক্ষা করুন…" : "পিন বদলান"}
      </Button>
    </form>
  );
}
