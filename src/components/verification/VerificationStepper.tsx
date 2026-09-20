import { CheckCircle, Circle } from 'lucide-react';

interface Step { label: string; description?: string }

interface VerificationStepperProps {
  steps: Step[];
  currentStep: number;
}

export default function VerificationStepper({ steps, currentStep }: VerificationStepperProps) {
  return (
    <div className="relative">
      <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-100 hidden md:block">
        <div
          className="h-full bg-green-500 transition-all duration-500"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />
      </div>

      <div className="flex justify-between relative">
        {steps.map((step, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
            <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all z-10 ${
              i < currentStep
                ? 'bg-green-600 border-green-600 text-white'
                : i === currentStep
                ? 'bg-white border-green-600 text-green-600'
                : 'bg-white border-gray-200 text-gray-400'
            }`}>
              {i < currentStep ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <span className="text-sm font-bold">{i + 1}</span>
              )}
            </div>
            <span className={`text-xs font-medium text-center hidden sm:block ${
              i === currentStep ? 'text-green-600' : i < currentStep ? 'text-green-500' : 'text-gray-400'
            }`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
