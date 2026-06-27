export interface PlantModel {
  key: string; sinhala: string; english: string; category: string; form: string;
  germinateDay: number; floweringDay: number; firstHarvestDay: number; maturityDay: number;
  maxHeightCm: number; spreadCm: number; growthK: number; growthMidpoint: number;
  leafColor: string; fruitColor: string; notes: string;
}
export interface PlantType { key: string; sinhala: string; english: string; category: string; form: string; model: PlantModel; }

export interface Project {
  id: number;
  name: string;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  environment: 'indoor' | 'outdoor' | 'mixed';
  has_iot: boolean;
  device_id?: string | null;
  notes?: string | null;
}

export interface GeoResult { name: string; admin1?: string; country?: string; latitude: number; longitude: number; label: string; }

export interface Weather {
  location?: string | null;
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: number;
  };
  current_units?: Record<string, string>;
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
}

export interface GrowBag { id: number; label: string; x: number; y: number; }

export interface Planting {
  id: number; plant_type_key: string; name: string; planted_date: string; count: number;
  status: string; notes?: string; sinhala: string; english: string; form: string; category: string;
  bags: { id: number; label: string }[];
}

export interface Milestone { key: string; label: string; day: number; date: string; done: boolean; }
export interface Timeline {
  plantingId: number; ageDays: number; model: PlantModel; correctionFactor: number;
  expectedHeightToday: number; milestones: Milestone[];
  curve: { day: number; date: string; predicted: number; corrected: number }[];
  actuals: { date: string; value: number; predicted: number }[];
}

export interface Measurement { id: number; date: string; metric: string; value: number; predicted: number | null; }
export interface PlantEvent {
  id: number; type: string; date: string; product?: string; dosage?: string;
  severity?: string; photo_path?: string; notes?: string;
}
export interface FertItem {
  id: number; planting_id: number; day_offset: number; product: string; dosage: string;
  method: string; status: string; due_date: string; in_days?: number; planting_name?: string;
}

export interface SensorReading { ts: string; temperature: number | null; humidity: number | null; soil_moisture: number | null; }
export interface Actuator {
  key: string; name?: string; state: boolean; mode: string;
  pin?: number | null; active_low?: boolean; is_default?: boolean; safety_cap_min?: number | null;
}
export interface Device { device_id: string; name: string; online: boolean; last_seen?: string; fw?: string; actuators: Actuator[]; }
export interface Schedule { id: number; device_id: string; actuator_key: string; days_mask: number; on_time: string; duration_min: number; enabled: number; }
export interface AutoRule {
  id: number; device_id: string; actuator_key: string; sensor: 'temperature' | 'humidity' | 'soil_moisture';
  on_above: number | null; off_below: number | null; on_below: number | null; off_above: number | null;
  max_run_min: number | null; enabled: boolean;
}

export interface Dashboard {
  project: Project | null;
  counts: { activePlantings: number; totalPlants: number; bags: number };
  device: Device | null;
  latestSensors: SensorReading | null;
  actuators: Actuator[];
  weather: Weather | null;
  dueFertilizer: FertItem[];
  upcomingMilestones: { planting: string; label: string; date: string; in_days: number }[];
}

export interface VisualizerItem {
  id: number; name: string; plant_type_key: string; form: string; leafColor: string; fruitColor: string;
  ageDays: number; maxHeightCm: number; spreadCm: number; expectedHeightCm: number;
  actualHeightCm: number | null; stage: string;
}
