import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/StoreContext';
import { calcularLitros, calcularCustoDiesel, calcularMargem, calcularCustoPorKm, formatCurrency } from '@/utils/calculadora';
import { getDistance, findGasStations, type GasStation } from '@/lib/googleMaps';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CurrencyInput from '@/components/CurrencyInput';
import CityAutocomplete, { type CitySelection } from '@/components/CityAutocomplete';
import { ArrowLeft, TrendingUp, TrendingDown, Calculator, Loader2, Fuel, Star, MapPin } from 'lucide-react';

const GOOGLE_MAPS_AVAILABLE = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function NovaViagem() {
  const navigate = useNavigate();
  const { profile, addViagem } = useAppStore();

  const [valorFrete, setValorFrete] = useState(0);
  const [origem, setOrigem] = useState<CitySelection | null>(null);
  const [destino, setDestino] = useState<CitySelection | null>(null);
  const [origemText, setOrigemText] = useState('');
  const [destinoText, setDestinoText] = useState('');
  const [distanciaKm, setDistanciaKm] = useState('');
  const [precoDiesel, setPrecoDiesel] = useState('6.29');
  const [durationText, setDurationText] = useState('');
  const [loadingDistance, setLoadingDistance] = useState(false);
  const [gasStations, setGasStations] = useState<GasStation[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [showStations, setShowStations] = useState(false);

  const distancia = parseFloat(distanciaKm) || 0;
  const precoDieselNum = parseFloat(precoDiesel) || 0;

  const litros = calcularLitros(distancia, profile.media_km_litro);
  const custoDiesel = calcularCustoDiesel(litros, precoDieselNum);
  const margem = calcularMargem(valorFrete, custoDiesel);
  const custoPorKm = calcularCustoPorKm(custoDiesel, distancia);
  const margemPercentual = valorFrete > 0 ? (margem / valorFrete) * 100 : 0;
  const valeAPena = margemPercentual >= 30;

  const calcularDistancia = useCallback(async () => {
    if (!origem?.placeId || !destino?.placeId) return;
    setLoadingDistance(true);
    try {
      const result = await getDistance(origem.placeId, destino.placeId);
      setDistanciaKm(String(result.distanceKm));
      setDurationText(result.durationText);
    } catch {
      setDurationText('');
    } finally {
      setLoadingDistance(false);
    }
  }, [origem, destino]);

  useEffect(() => {
    if (GOOGLE_MAPS_AVAILABLE && origem?.placeId && destino?.placeId) {
      calcularDistancia();
    }
  }, [origem, destino, calcularDistancia]);

  const buscarPostos = useCallback(async () => {
    if (!origem?.lat || !origem?.lng) return;
    setLoadingStations(true);
    setShowStations(true);
    try {
      const stations = await findGasStations(origem.lat, origem.lng);
      setGasStations(stations);
    } catch {
      setGasStations([]);
    } finally {
      setLoadingStations(false);
    }
  }, [origem]);

  const handleOrigemChange = (city: CitySelection | null) => {
    setOrigem(city);
    setOrigemText(city?.description ?? '');
    setGasStations([]);
    setShowStations(false);
  };

  const handleDestinoChange = (city: CitySelection | null) => {
    setDestino(city);
    setDestinoText(city?.description ?? '');
  };

  const cidadeOrigem = origem?.description ?? origemText;
  const cidadeDestino = destino?.description ?? destinoText;

  const handleIniciar = () => {
    if (!cidadeOrigem || !cidadeDestino || !valorFrete || !distancia) return;
    const viagem = addViagem({
      cidade_origem: cidadeOrigem,
      cidade_destino: cidadeDestino,
      distancia_km: distancia,
      valor_frete: valorFrete,
      preco_diesel: precoDieselNum,
      litros_estimados: litros,
      custo_estimado_diesel: custoDiesel,
      status: 'ativa',
      data_inicio: new Date().toISOString(),
    });
    navigate(`/viagem/${viagem.id}`);
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">Simulador de Frete</h1>
      </div>

      <div className="space-y-4">
        {/* Valor do Frete */}
        <div>
          <Label>Valor do Frete</Label>
          <CurrencyInput
            value={valorFrete}
            onChange={setValorFrete}
            placeholder="0,00"
            className="mt-1 h-12 text-lg"
          />
        </div>

        {/* Origem e Destino */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Origem</Label>
            {GOOGLE_MAPS_AVAILABLE ? (
              <CityAutocomplete
                value={origemText}
                onChange={handleOrigemChange}
                placeholder="Ex: Londrina"
                className="mt-1 h-12"
              />
            ) : (
              <Input
                placeholder="São Paulo"
                value={origemText}
                onChange={e => { setOrigemText(e.target.value); setOrigem(null); }}
                className="mt-1 h-12"
              />
            )}
          </div>
          <div>
            <Label>Destino</Label>
            {GOOGLE_MAPS_AVAILABLE ? (
              <CityAutocomplete
                value={destinoText}
                onChange={handleDestinoChange}
                placeholder="Ex: São Paulo"
                className="mt-1 h-12"
              />
            ) : (
              <Input
                placeholder="Curitiba"
                value={destinoText}
                onChange={e => { setDestinoText(e.target.value); setDestino(null); }}
                className="mt-1 h-12"
              />
            )}
          </div>
        </div>

        {/* Distância e Diesel */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Distância (km)</Label>
            <div className="relative">
              <Input
                type="number"
                inputMode="numeric"
                placeholder="400"
                value={distanciaKm}
                onChange={e => setDistanciaKm(e.target.value)}
                className="mt-1 h-12"
              />
              {loadingDistance && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
              )}
            </div>
            {durationText && (
              <p className="mt-1 text-xs text-muted-foreground">Tempo estimado: {durationText}</p>
            )}
          </div>
          <div>
            <Label>Diesel (R$/L)</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={precoDiesel}
              onChange={e => setPrecoDiesel(e.target.value)}
              className="mt-1 h-12"
            />
          </div>
        </div>

        {/* Botão postos */}
        {GOOGLE_MAPS_AVAILABLE && origem?.lat !== undefined && origem?.lat !== 0 && (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={buscarPostos}
            disabled={loadingStations}
          >
            {loadingStations ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Fuel className="h-4 w-4" />
            )}
            Buscar postos de diesel próximos à origem
          </Button>
        )}

        {/* Lista de postos */}
        {showStations && (
          <div className="rounded-lg border border-border bg-card p-3 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Fuel className="h-4 w-4 text-primary" />
              Postos próximos — {origem?.description}
            </h3>
            {loadingStations ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : gasStations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhum posto encontrado na região.</p>
            ) : (
              <ul className="space-y-2 max-h-56 overflow-y-auto">
                {gasStations.map(station => (
                  <li
                    key={station.placeId}
                    className="flex items-start gap-2 rounded-md bg-secondary/50 p-2.5 text-sm"
                  >
                    <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{station.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{station.address}</p>
                      {station.fuelPrices && station.fuelPrices.length > 0 && (
                        <p className="text-xs font-semibold text-primary mt-0.5">
                          Diesel: {station.fuelPrices[0].price}
                        </p>
                      )}
                    </div>
                    {station.rating && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-500 shrink-0">
                        <Star className="h-3 w-3 fill-current" />
                        {station.rating.toFixed(1)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-muted-foreground/70 pt-1">
              Preços podem variar. Consulte o posto para valores atualizados de diesel.
            </p>
          </div>
        )}
      </div>

      {/* Resultado */}
      {distancia > 0 && valorFrete > 0 && (
        <div className={`rounded-lg border p-4 space-y-3 ${valeAPena ? 'border-success/40 bg-success/5' : 'border-destructive/40 bg-destructive/5'}`}>
          <div className="flex items-center gap-2">
            {valeAPena ? (
              <TrendingUp className="h-5 w-5 text-success" />
            ) : (
              <TrendingDown className="h-5 w-5 text-destructive" />
            )}
            <span className={`text-sm font-bold ${valeAPena ? 'text-success' : 'text-destructive'}`}>
              {valeAPena ? '🟢 Vale a pena!' : '🔴 Margem baixa'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Litros estimados</span>
              <p className="font-semibold">{litros.toFixed(1)} L</p>
            </div>
            <div>
              <span className="text-muted-foreground">Custo diesel</span>
              <p className="font-semibold">{formatCurrency(custoDiesel)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Margem bruta</span>
              <p className={`font-semibold ${valeAPena ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(margem)} ({margemPercentual.toFixed(0)}%)
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Custo/km</span>
              <p className="font-semibold">{formatCurrency(custoPorKm)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1 h-14 text-base" onClick={() => navigate(-1)}>
          Voltar
        </Button>
        <Button
          className="flex-1 h-14 text-base font-bold"
          onClick={handleIniciar}
          disabled={!cidadeOrigem || !cidadeDestino || !valorFrete || !distancia}
        >
          <Calculator className="mr-2 h-5 w-5" />
          Iniciar Viagem
        </Button>
      </div>
    </div>
  );
}
