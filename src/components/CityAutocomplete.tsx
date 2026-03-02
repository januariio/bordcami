import { useEffect, useRef, useState, useCallback } from 'react';
import { loadPlaces } from '@/lib/googleMaps';
import { cn } from '@/lib/utils';
import { MapPin, Loader2 } from 'lucide-react';

export interface CitySelection {
  description: string;
  placeId: string;
  lat: number;
  lng: number;
}

interface CityAutocompleteProps {
  value: string;
  onChange: (city: CitySelection | null) => void;
  placeholder?: string;
  className?: string;
}

interface Suggestion {
  description: string;
  placeId: string;
}

export default function CityAutocomplete({ value, onChange, placeholder, className }: CityAutocompleteProps) {
  const [input, setInput] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setInput(value);
  }, [value]);

  useEffect(() => {
    loadPlaces().then(() => {
      autocompleteRef.current = new google.maps.places.AutocompleteService();
      geocoderRef.current = new google.maps.Geocoder();
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback((text: string) => {
    if (!autocompleteRef.current || text.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    autocompleteRef.current.getPlacePredictions(
      {
        input: text,
        componentRestrictions: { country: 'br' },
        types: ['(cities)'],
        language: 'pt-BR',
      },
      (predictions, status) => {
        setLoading(false);
        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
          setSuggestions([]);
          return;
        }
        setSuggestions(
          predictions.map(p => ({
            description: p.description,
            placeId: p.place_id,
          })),
        );
      },
    );
  }, []);

  const handleInputChange = (text: string) => {
    setInput(text);
    setOpen(true);
    onChange(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 300);
  };

  const handleSelect = async (suggestion: Suggestion) => {
    setInput(suggestion.description);
    setSuggestions([]);
    setOpen(false);

    if (geocoderRef.current) {
      try {
        const result = await geocoderRef.current.geocode({ placeId: suggestion.placeId });
        const loc = result.results[0]?.geometry?.location;
        if (loc) {
          onChange({
            description: suggestion.description,
            placeId: suggestion.placeId,
            lat: loc.lat(),
            lng: loc.lng(),
          });
          return;
        }
      } catch {}
    }
    onChange({
      description: suggestion.description,
      placeId: suggestion.placeId,
      lat: 0,
      lng: 0,
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-8 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm',
            className,
          )}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(s => (
            <li key={s.placeId}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors"
              >
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{s.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
