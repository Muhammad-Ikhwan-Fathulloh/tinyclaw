import { useState, useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { SetupWizardStepper } from "@/components/setup-wizard/SetupWizardStepper";
import { SetupStepProvider } from "@/components/setup-wizard/SetupStepProvider";
import { SetupStepUserContext } from "@/components/setup-wizard/SetupStepUserContext";
import { SetupStepTelegram } from "@/components/setup-wizard/SetupStepTelegram";
import { SetupStepWhatsApp } from "@/components/setup-wizard/SetupStepWhatsApp";
import { pathForPage } from "@/lib/navigation";

export const SETUP_STEPS = [
  { id: 1, label: "Provider", required: true },
  { id: 2, label: "About You", required: false },
  { id: 3, label: "Telegram", required: false },
  { id: 4, label: "WhatsApp", required: false },
] as const;

export type SetupStepId = (typeof SETUP_STEPS)[number]["id"];

export interface SetupWizardProps {
  onComplete?: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<SetupStepId>(1);

  const goNext = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= 4) {
        return 4;
      }
      return (prev + 1) as SetupStepId;
    });
  }, []);

  const goSkip = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= 4) {
        return 4;
      }
      return (prev + 1) as SetupStepId;
    });
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev <= 1) {
        return 1;
      }
      return (prev - 1) as SetupStepId;
    });
  }, []);

  const handleComplete = useCallback(() => {
    if (onComplete) {
      onComplete();
    } else {
      navigate(pathForPage("chat"), { replace: true });
    }
  }, [navigate, onComplete]);

  const handleStepAdvance = useCallback(() => {
    if (currentStep >= 4) {
      handleComplete();
    } else {
      goNext();
    }
  }, [currentStep, goNext, handleComplete]);

  const handleSkip = useCallback(() => {
    if (currentStep >= 4) {
      handleComplete();
    } else {
      goSkip();
    }
  }, [currentStep, goSkip, handleComplete]);

  const heading = currentStep === 1
    ? "Welcome to TinyClaw"
    : currentStep === 2
      ? "Tell us about yourself"
      : currentStep === 3
        ? "Connect Telegram"
        : "Connect WhatsApp";

  const subtitle = currentStep === 1
    ? "Set up your AI provider to get started. You can add more later."
    : currentStep === 2
      ? "Help the agent understand your preferences — optional."
      : currentStep === 3
        ? "Link Telegram so the agent can message you — optional."
        : "Link WhatsApp so the agent can message you — optional.";

  function renderStep(): ReactNode {
    switch (currentStep) {
      case 1:
        return (
          <SetupStepProvider onNext={() => handleStepAdvance()} />
        );
      case 2:
        return (
          <SetupStepUserContext
            onNext={handleStepAdvance}
            onSkip={handleSkip}
            onBack={goBack}
          />
        );
      case 3:
        return (
          <SetupStepTelegram
            onNext={handleStepAdvance}
            onSkip={handleSkip}
            onBack={goBack}
          />
        );
      case 4:
        return (
          <SetupStepWhatsApp
            onNext={handleStepAdvance}
            onSkip={handleSkip}
            onBack={goBack}
          />
        );
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">{heading}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <SetupWizardStepper currentStep={currentStep} />

      <div key={currentStep}>
        {renderStep()}
      </div>
    </div>
  );
}