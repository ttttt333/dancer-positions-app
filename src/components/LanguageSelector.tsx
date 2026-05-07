import { useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { LOCALE_INFO } from "../i18n/locales";
import { APP_LOCALES } from "../i18n/types";

interface LanguageSelectorProps {
  className?: string;
  showFlag?: boolean;
  showNativeName?: boolean;
  compact?: boolean;
}

export function LanguageSelector({ 
  className = "", 
  showFlag = true,
  showNativeName = true,
  compact = false 
}: LanguageSelectorProps) {
  const { locale, setLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const currentLocale = LOCALE_INFO[locale];
  
  const handleLanguageChange = (newLocale: typeof locale) => {
    setLocale(newLocale);
    setIsOpen(false);
  };

  if (compact) {
    return (
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${className}`}
        title={currentLocale.name}
        aria-label={`Change language from ${currentLocale.name}`}
      >
        <span className="text-lg">{showFlag ? currentLocale.flag : currentLocale.nativeName}</span>
        
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
            {APP_LOCALES.map((localeCode) => {
              const localeInfo = LOCALE_INFO[localeCode];
              return (
                <button
                  key={localeCode}
                  onClick={() => handleLanguageChange(localeCode)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 ${
                    localeCode === locale ? "bg-blue-50 text-blue-600" : ""
                  }`}
                >
                  {showFlag && <span>{localeInfo.flag}</span>}
                  <div>
                    <div className="font-medium">{localeInfo.nativeName}</div>
                    <div className="text-xs text-gray-500">{localeInfo.name}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </button>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        aria-expanded={isOpen ? "true" : "false"}
        aria-haspopup="listbox"
        aria-label="Select language"
      >
        {showFlag && <span>{currentLocale.flag}</span>}
        <span className="font-medium">{showNativeName ? currentLocale.nativeName : currentLocale.name}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div 
          className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[250px] max-h-80 overflow-y-auto"
          role="listbox"
        >
          <div className="p-2 border-b border-gray-100">
            <div className="text-sm font-medium text-gray-700">言語 / Language</div>
          </div>
          
          {APP_LOCALES.map((localeCode) => {
            const localeInfo = LOCALE_INFO[localeCode];
            const isSelected = localeCode === locale;
            
            return (
              <button
                key={localeCode}
                onClick={() => handleLanguageChange(localeCode)}
                className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3 ${
                  isSelected ? "bg-blue-50 text-blue-600" : ""
                }`}
                role="option"
                aria-selected={isSelected ? "true" : "false"}
              >
                {showFlag && <span className="text-lg">{localeInfo.flag}</span>}
                <div className="flex-1">
                  <div className="font-medium">{localeInfo.nativeName}</div>
                  <div className="text-xs text-gray-500">{localeInfo.name}</div>
                </div>
                {isSelected && (
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageSelector;
