"use client";

import Image from "next/image";
import { FormEvent, type ReactNode, useEffect, useState } from "react";
import verifiedBadge from "../../../assets/verified.png";
import {
  isQuestionFilled,
  isQuestionVisible,
  questions,
  type AnswerValue,
  type ApplicationQuestion,
} from "@/lib/application-questions";
import type { DiscordUser } from "@/lib/discord";
import type { ServerUserStats } from "@/lib/mongodb";
import {
  getDiscordAvatarUrl,
  getDiscordDisplayName,
} from "@/lib/discord";

type FormSection = 1 | 2 | 3;
type SectionTransition = "idle" | "exit" | "enter";

const TOTAL_SECTIONS = 3;
const SECTION_NAMES = [
  "Discord Account",
  "Background Info",
  "Why You're a Good Fit",
] as const;
const SECTION_EXIT_MS = 280;
const SECTION_ENTER_MS = 380;

const APPLICATION_MIN_LEVEL = 5;
const APPLICATION_MIN_REPUTATION = 40;

type ApplicationRequirement = {
  id: string;
  label: string;
  met: boolean | null;
};

function getApplicationRequirements(
  serverStats: ServerUserStats,
): ApplicationRequirement[] {
  const levelMet =
    serverStats?.found === true
      ? serverStats.level >= APPLICATION_MIN_LEVEL
      : serverStats?.found === false
        ? false
        : null;

  const reputationMet =
    serverStats?.found === true
      ? serverStats.reputation >= APPLICATION_MIN_REPUTATION
      : serverStats?.found === false
        ? false
        : null;

  return [
    {
      id: "level",
      label: `Level ${APPLICATION_MIN_LEVEL}`,
      met: levelMet,
    },
    {
      id: "reputation",
      label: `${APPLICATION_MIN_REPUTATION}+ Reputation`,
      met: reputationMet,
    },
  ];
}

function RequirementStatusIcon({ met }: { met: boolean | null }) {
  if (met === null) {
    return (
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--discord-bg)] text-[var(--discord-muted)]"
        aria-hidden="true"
      >
        ?
      </span>
    );
  }

  if (met) {
    return (
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#23a559]/15 text-[#23a559]"
        aria-hidden="true"
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f23f43]/15 text-[#f23f43]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
        <path
          fillRule="evenodd"
          d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

function RequirementsSection({ serverStats }: { serverStats: ServerUserStats }) {
  const requirements = getApplicationRequirements(serverStats);

  return (
    <div className="mt-3 border-t border-[var(--discord-input-border)] pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--discord-muted)]">
        Requirements
      </p>
      <ul className="mt-2 space-y-1.5">
        {requirements.map((requirement) => (
          <li
            key={requirement.id}
            className="flex items-center justify-between gap-2 rounded-md bg-[var(--discord-bg)] px-3 py-2"
          >
            <span className="text-sm text-[var(--discord-text)]">
              {requirement.label}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-medium ${
                  requirement.met === null
                    ? "text-[var(--discord-muted)]"
                    : requirement.met
                      ? "text-[#23a559]"
                      : "text-[#f23f43]"
                }`}
              >
                {requirement.met === null
                  ? "Unknown"
                  : requirement.met
                    ? "Met"
                    : "Not met"}
              </span>
              <RequirementStatusIcon met={requirement.met} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function isSectionComplete(
  sectionNumber: 2 | 3,
  answers: Record<string, AnswerValue>,
): boolean {
  return questions
    .filter((question) => question.section === sectionNumber)
    .filter(
      (question) =>
        question.required && isQuestionVisible(question, answers),
    )
    .every((question) => isQuestionFilled(question, answers[question.id]));
}

function RequiredAsterisk() {
  return (
    <span className="text-[#f23f43]" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

function SectionHeading({
  section,
  title,
}: {
  section: FormSection;
  title: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-[var(--discord-muted)]">Section {section}</p>
      <h2 className="text-2xl font-semibold text-[var(--discord-text)]">{title}</h2>
    </div>
  );
}

function SectionProgressBar({
  currentSection,
  transition,
}: {
  currentSection: FormSection;
  transition: SectionTransition;
}) {
  const nextSectionName =
    currentSection === 1 || currentSection === 2
      ? SECTION_NAMES[currentSection]
      : null;

  const animationClass =
    transition === "exit"
      ? "animate-section-out"
      : transition === "enter"
        ? "animate-section-in"
        : "";

  return (
    <div className={`mb-3 ${animationClass}`}>
      {nextSectionName ? (
        <p className="mb-2 text-xs text-[var(--discord-muted)]">
          Next Section:{" "}
          <span className="font-medium text-[var(--discord-text)]">
            {nextSectionName}
          </span>
        </p>
      ) : null}
      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuenow={currentSection}
        aria-valuemin={1}
        aria-valuemax={TOTAL_SECTIONS}
        aria-label={`Section ${currentSection} of ${TOTAL_SECTIONS}`}
      >
        {Array.from({ length: TOTAL_SECTIONS }, (_, index) => {
          const segmentNumber = index + 1;
          const isFilled = segmentNumber <= currentSection;

          return (
            <div
              key={segmentNumber}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                isFilled
                  ? "bg-[var(--discord-blurple)]"
                  : "bg-[var(--discord-input)]"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

function QuestionLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required: boolean;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold uppercase tracking-wide text-[var(--discord-muted)]"
    >
      {children}
      {required ? <RequiredAsterisk /> : null}
    </label>
  );
}

function QuestionField({
  question,
  answers,
  onAnswerChange,
  onCheckboxChange,
  showLabel = true,
}: {
  question: ApplicationQuestion;
  answers: Record<string, AnswerValue>;
  onAnswerChange: (id: string, value: string) => void;
  onCheckboxChange: (id: string, option: string, checked: boolean) => void;
  showLabel?: boolean;
}) {
  if (!isQuestionVisible(question, answers)) {
    return null;
  }

  return (
    <div
      className={`space-y-1.5 ${question.showWhen ? "animate-fade-in-up" : ""}`}
    >
      {question.type === "checkbox" ? (
        <>
          <QuestionLabel
            htmlFor={`${question.id}-0`}
            required={question.required}
          >
            {question.label}
          </QuestionLabel>
          <fieldset className="space-y-2">
            <legend className="sr-only">{question.label}</legend>
            {(question.options ?? []).map((option, index) => {
              const optionId = `${question.id}-${index}`;
              const selected = Array.isArray(answers[question.id])
                ? answers[question.id].includes(option)
                : false;

              return (
                <label
                  key={option}
                  htmlFor={optionId}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-[var(--discord-input-border)] bg-[var(--discord-input)] px-3 py-2.5 text-sm text-[var(--discord-text)] transition-[border-color,background-color] duration-200 has-[:checked]:border-[var(--discord-blurple)] has-[:checked]:bg-[rgba(88,101,242,0.08)]"
                >
                  <input
                    id={optionId}
                    type="checkbox"
                    name={question.id}
                    value={option}
                    checked={selected}
                    onChange={(event) =>
                      onCheckboxChange(
                        question.id,
                        option,
                        event.target.checked,
                      )
                    }
                    className="h-4 w-4 shrink-0 rounded border-[var(--discord-input-border)] bg-[var(--discord-bg)] text-[var(--discord-blurple)] focus:ring-[var(--discord-blurple)] focus:ring-offset-0"
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </fieldset>
        </>
      ) : question.type === "radio" ? (
        <>
          <QuestionLabel
            htmlFor={`${question.id}-0`}
            required={question.required}
          >
            {question.label}
          </QuestionLabel>
          <fieldset className="space-y-2">
            <legend className="sr-only">{question.label}</legend>
            {(question.options ?? []).map((option, index) => {
              const optionId = `${question.id}-${index}`;
              const selected = answers[question.id] === option;

              return (
                <label
                  key={option}
                  htmlFor={optionId}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-[var(--discord-input-border)] bg-[var(--discord-input)] px-3 py-2.5 text-sm text-[var(--discord-text)] transition-[border-color,background-color] duration-200 has-[:checked]:border-[var(--discord-blurple)] has-[:checked]:bg-[rgba(88,101,242,0.08)]"
                >
                  <input
                    id={optionId}
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={selected}
                    onChange={() => onAnswerChange(question.id, option)}
                    className="h-4 w-4 shrink-0 border-[var(--discord-input-border)] bg-[var(--discord-bg)] text-[var(--discord-blurple)] focus:ring-[var(--discord-blurple)] focus:ring-offset-0"
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </fieldset>
        </>
      ) : (
        <>
          {showLabel ? (
            <QuestionLabel htmlFor={question.id} required={question.required}>
              {question.label}
            </QuestionLabel>
          ) : null}
          {question.type === "text" ? (
            <input
              id={question.id}
              name={question.id}
              type="text"
              placeholder={question.placeholder}
              value={
                typeof answers[question.id] === "string"
                  ? answers[question.id]
                  : ""
              }
              onChange={(event) =>
                onAnswerChange(question.id, event.target.value)
              }
              className="w-full rounded-md border border-[var(--discord-input-border)] bg-[var(--discord-input)] px-3 py-2.5 text-sm text-[var(--discord-text)] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--discord-muted)] focus:border-[var(--discord-blurple)] focus:shadow-[0_0_0_1px_var(--discord-blurple)]"
            />
          ) : (
            <textarea
              id={question.id}
              name={question.id}
              rows={question.rows ?? 5}
              placeholder={question.placeholder}
              aria-label={showLabel ? undefined : question.label}
              value={
                typeof answers[question.id] === "string"
                  ? answers[question.id]
                  : ""
              }
              onChange={(event) =>
                onAnswerChange(question.id, event.target.value)
              }
              className="w-full resize-none rounded-md border border-[var(--discord-input-border)] bg-[var(--discord-input)] px-3 py-2.5 text-sm leading-relaxed text-[var(--discord-text)] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--discord-muted)] focus:border-[var(--discord-blurple)] focus:shadow-[0_0_0_1px_var(--discord-blurple)]"
            />
          )}
        </>
      )}
    </div>
  );
}

type ApplicationFormProps = {
  discordUser: DiscordUser | null;
  oauthConfigured: boolean;
  serverStats: ServerUserStats;
  discordError?: string | null;
  onSubmitted?: () => void;
};

function DiscordLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-current"
    >
      <path d="M20.317 4.369A19.791 19.791 0 0 0 16.885 3.2a.074.074 0 0 0-.079.037 12.3 12.3 0 0 0-.608 1.243 18.224 18.224 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.243.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z" />
    </svg>
  );
}

function ServerStatsSection({ serverStats }: { serverStats: ServerUserStats }) {
  if (serverStats === null) {
    return null;
  }

  if (!serverStats.found) {
    return (
      <p className="mt-3 text-xs text-[var(--discord-muted)]">
        No server profile found for this Discord account.
      </p>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <div className="rounded-md bg-[var(--discord-bg)] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--discord-muted)]">
          Level
        </p>
        <p className="text-sm font-semibold text-[var(--discord-text)]">
          {serverStats.level}
        </p>
      </div>
      <div className="rounded-md bg-[var(--discord-bg)] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--discord-muted)]">
          Reputation
        </p>
        <p className="text-sm font-semibold text-[var(--discord-text)]">
          {serverStats.reputation}
        </p>
      </div>
    </div>
  );
}

function DiscordVerifySection({
  discordUser,
  oauthConfigured,
  serverStats,
  discordError,
}: ApplicationFormProps) {
  if (!oauthConfigured) {
    return (
      <p className="rounded-md border border-[var(--discord-input-border)] bg-[var(--discord-input)] px-3 py-2.5 text-sm text-[var(--discord-muted)]">
        Discord verification is not configured. Add your Discord app credentials
        to enable sign-in.
      </p>
    );
  }

  if (discordUser) {
    const displayName = getDiscordDisplayName(discordUser);

    return (
      <div className="rounded-md border border-[var(--discord-input-border)] bg-[var(--discord-input)] p-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getDiscordAvatarUrl(discordUser)}
            alt=""
            width={40}
            height={40}
            className="rounded-full"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--discord-text)]">
              {displayName}
            </p>
            <p className="truncate text-xs text-[var(--discord-muted)]">
              @{discordUser.username}
            </p>
          </div>
          <Image
            src={verifiedBadge}
            alt="Verified"
            width={22}
            height={22}
            className="shrink-0"
          />
        </div>
        <ServerStatsSection serverStats={serverStats} />
        <RequirementsSection serverStats={serverStats} />
        <a
          href="/api/auth/discord/clear?returnTo=/applications"
          className="mt-3 inline-block text-xs text-[var(--discord-blurple)] transition-colors hover:text-[var(--discord-blurple-hover)]"
        >
          Use a different account
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {discordError ? (
        <p className="text-sm text-[#f23f43]">{discordError}</p>
      ) : null}
      <a
        href="/api/auth/discord?returnTo=/applications"
        className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--discord-blurple)] py-2.5 text-sm font-medium text-white transition-[background-color,transform,box-shadow] duration-200 hover:bg-[var(--discord-blurple-hover)] hover:shadow-[0_4px_20px_rgba(88,101,242,0.35)] active:scale-[0.98]"
      >
        <DiscordLogo />
        Verify with Discord
      </a>
      <div className="rounded-md border border-[var(--discord-input-border)] bg-[var(--discord-input)] px-3 py-2.5">
        <p className="text-xs font-medium text-[var(--discord-text)]">
          Why do we need this?
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--discord-muted)]">
          This is to ensure that there are no joke applications or applications
          submitted by other people on your behalf (impersonation).
        </p>
      </div>
    </div>
  );
}

const NEXT_STEPS = [
  "Our team reviews your application.",
  "You'll hear back via Discord if you're selected.",
  "Keep an eye on your DMs and server announcements.",
] as const;

function SubmissionSuccess({ discordUser }: { discordUser: DiscordUser }) {
  const displayName = getDiscordDisplayName(discordUser);

  return (
    <div className="animate-fade-in-up space-y-5 pb-2">
      <div className="flex flex-col items-center text-center">
        <h2 className="text-2xl font-semibold text-[var(--discord-text)]">
          Application submitted!
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--discord-muted)]">
          Thanks, {displayName}! We&apos;ll review your submission and reach out
          if we have questions!
        </p>
      </div>

      <div className="rounded-md border border-[var(--discord-input-border)] bg-[var(--discord-input)] p-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getDiscordAvatarUrl(discordUser)}
            alt=""
            width={40}
            height={40}
            className="rounded-full"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--discord-text)]">
              {displayName}
            </p>
            <p className="truncate text-xs text-[var(--discord-muted)]">
              @{discordUser.username}
            </p>
          </div>
          <Image
            src={verifiedBadge}
            alt="Verified"
            width={22}
            height={22}
            className="shrink-0"
          />
        </div>
      </div>

      <div className="rounded-md border border-[var(--discord-input-border)] bg-[var(--discord-input)] px-3 py-2.5">
        <p className="text-xs font-medium text-[var(--discord-text)]">
          What happens next?
        </p>
        <ul className="mt-2.5 space-y-2">
          {NEXT_STEPS.map((step, index) => (
            <li key={step} className="flex gap-2.5">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--discord-blurple)]/15 text-[10px] font-semibold text-[var(--discord-blurple)]"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="text-xs leading-relaxed text-[var(--discord-muted)]">
                {step}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ApplicationForm({
  discordUser,
  oauthConfigured,
  serverStats,
  discordError,
  onSubmitted,
}: ApplicationFormProps) {
  const [section, setSection] = useState<FormSection>(1);
  const [transition, setTransition] = useState<SectionTransition>("idle");
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() =>
    Object.fromEntries(
      questions.map((question) => [
        question.id,
        question.type === "checkbox" ? [] : "",
      ]),
    ),
  );
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const requiredQuestionsFilled =
    isSectionComplete(2, answers) && isSectionComplete(3, answers);

  const canAdvanceSection =
    section === 1
      ? Boolean(discordUser)
      : section === 2
        ? isSectionComplete(2, answers)
        : false;

  function handleAnswerChange(id: string, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };

      for (const question of questions) {
        if (
          question.showWhen?.field === id &&
          value !== question.showWhen.value
        ) {
          next[question.id] = question.type === "checkbox" ? [] : "";
        }
      }

      return next;
    });
  }

  function handleCheckboxChange(id: string, option: string, checked: boolean) {
    setAnswers((prev) => {
      const current = Array.isArray(prev[id]) ? prev[id] : [];

      return {
        ...prev,
        [id]: checked
          ? [...current, option]
          : current.filter((value) => value !== option),
      };
    });
  }

  useEffect(() => {
    if (transition === "exit") {
      const timer = window.setTimeout(() => {
        setSection((prev) => (prev + 1) as FormSection);
        setTransition("enter");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, SECTION_EXIT_MS);

      return () => window.clearTimeout(timer);
    }

    if (transition === "enter") {
      const timer = window.setTimeout(() => {
        setTransition("idle");
      }, SECTION_ENTER_MS);

      return () => window.clearTimeout(timer);
    }
  }, [transition]);

  function handleNextSection() {
    if (!canAdvanceSection || transition !== "idle" || section >= TOTAL_SECTIONS) {
      return;
    }

    setTransition("exit");
  }

  const sectionQuestions = questions.filter(
    (question) => question.section === section,
  );
  const sectionAnimationClass =
    transition === "exit"
      ? "animate-section-out"
      : transition === "enter"
        ? "animate-section-in"
        : section === 1
          ? "animate-fade-in-up animate-delay-3"
          : "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!discordUser || !requiredQuestionsFilled || submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/applications/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answers }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to submit your application.");
      }

      setSubmitted(true);
      onSubmitted?.();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to submit your application.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted && discordUser) {
    return <SubmissionSuccess discordUser={discordUser} />;
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="pb-24">
      <div className="overflow-hidden">
      {section === 1 ? (
        <div className={`space-y-1.5 ${sectionAnimationClass}`}>
          <SectionHeading
            section={1}
            title={SECTION_NAMES[0]}
          />
          <DiscordVerifySection
            discordUser={discordUser}
            oauthConfigured={oauthConfigured}
            serverStats={serverStats}
            discordError={discordError}
          />
        </div>
      ) : (
        <div className={`space-y-5 ${sectionAnimationClass}`}>
          <SectionHeading
            section={section}
            title={SECTION_NAMES[section - 1]}
          />
          {sectionQuestions.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              answers={answers}
              onAnswerChange={handleAnswerChange}
              onCheckboxChange={handleCheckboxChange}
            />
          ))}
        </div>
      )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-10 bg-[var(--discord-card)] px-5 py-4 sm:left-1/2 sm:w-full sm:max-w-[420px] sm:-translate-x-1/2">
        {submitError ? (
          <p className="mb-3 text-sm text-[#f23f43]">{submitError}</p>
        ) : null}
        <SectionProgressBar currentSection={section} transition={transition} />
        {section < TOTAL_SECTIONS ? (
          <button
            type="button"
            onClick={handleNextSection}
            disabled={!canAdvanceSection || transition !== "idle"}
            className={`block w-full rounded-md bg-[var(--discord-blurple)] py-2.5 text-center text-sm font-medium text-white transition-[background-color,transform,box-shadow,opacity] duration-200 hover:bg-[var(--discord-blurple-hover)] hover:shadow-[0_4px_20px_rgba(88,101,242,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--discord-blurple)] disabled:hover:shadow-none disabled:active:scale-100 ${transition === "exit" ? "animate-section-out" : ""}`}
          >
            Next Section
          </button>
        ) : (
          <button
            type="submit"
            disabled={!requiredQuestionsFilled || submitting || transition !== "idle"}
            className={`block w-full rounded-md bg-[var(--discord-blurple)] py-2.5 text-center text-sm font-medium text-white transition-[background-color,transform,box-shadow,opacity] duration-200 hover:bg-[var(--discord-blurple-hover)] hover:shadow-[0_4px_20px_rgba(88,101,242,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--discord-blurple)] disabled:hover:shadow-none disabled:active:scale-100 ${transition === "enter" ? "animate-section-in" : ""}`}
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        )}
      </div>
    </form>
  );
}
