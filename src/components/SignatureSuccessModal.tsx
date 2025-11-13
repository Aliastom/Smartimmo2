"use client";
import React from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  signatureUrl: string;
}

export default function SignatureSuccessModal({ isOpen, onClose, signatureUrl }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-base-content bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-base-content mb-2">
              Signature enregistrée
            </h3>
          </div>
          
          <div className="mb-4">
            <p className="text-sm text-base-content opacity-80 mb-3">
              Elle sera apposée sur vos quittances.
            </p>
            <div className="border border-base-300 rounded-lg p-3 bg-base-200">
              <img 
                src={signatureUrl} 
                alt="Signature enregistrée" 
                style={{ 
                  maxWidth: "200px", 
                  height: "auto", 
                  maxHeight: "80px",
                  display: "block",
                  margin: "0 auto"
                }}
              />
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary text-base-100 rounded-md hover:bg-primary transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
