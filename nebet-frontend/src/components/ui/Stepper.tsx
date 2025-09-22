import React from 'react';
import { clsx } from 'clsx';
import { CheckIcon } from '@heroicons/react/24/solid';

export interface StepperProps {
  steps: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  currentStep: number;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({ steps, currentStep, className }) => {
  return (
    <div className={clsx('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex flex-col items-center flex-1">
            {/* Step indicator */}
            <div className="flex items-center w-full">
              <div className="flex-shrink-0">
                <div
                  className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200',
                    {
                      'bg-[#275365] text-white': index < currentStep,
                      'bg-gradient-to-r from-[#275365] to-[#3B7F9F] text-white ring-4 ring-[#275365]/20': index === currentStep,
                      'bg-[#8F969C]/20 text-[#8F969C]': index > currentStep,
                    }
                  )}
                >
                  {index < currentStep ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
              </div>
              
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="flex-1 ml-4">
                  <div
                    className={clsx(
                      'h-0.5 transition-all duration-200',
                      {
                        'bg-[#275365]': index < currentStep,
                        'bg-[#8F969C]/30': index >= currentStep,
                      }
                    )}
                  />
                </div>
              )}
            </div>
            
            {/* Step labels */}
            <div className="mt-2 text-center">
              <p
                className={clsx(
                  'text-sm font-medium font-body transition-colors',
                  {
                    'text-[#1E2E3F]': index <= currentStep,
                    'text-[#8F969C]': index > currentStep,
                  }
                )}
              >
                {step.name}
              </p>
              {step.description && (
                <p className="mt-1 text-xs text-[#8F969C] font-body">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};