// A stop on the map, and the departure board shown when the visitor clicks one. The server
// (app/api/stops and app/api/departures) builds these from Entur's answers.

// What Entur calls a "stop place": one named stop, with all its platforms and both directions.
export type StopPlace = {
  id: string; // e.g. "NSR:StopPlace:30904"
  name: string;
  lat: number;
  lon: number;
};

export type Departure = {
  line: string; // the number on the front, e.g. "4"
  destination: string;
  aimed: string; // the departure time in the timetable
  expected: string; // the departure time Entur now expects
  platform: string; // the letter or number on the platform sign; empty when the stop has none
  cancelled: boolean;
  // The trip's id. A vehicle on the map carries the same id, which is how a departure on the board
  // can be matched to the dot that is driving it.
  journeyId: string;
};

export type Board = {
  name: string;
  departures: Departure[];
};
