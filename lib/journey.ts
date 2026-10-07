// One trip ("journey") of one vehicle: the road it follows and the stops along it. The server
// (app/api/journey/route.ts) builds it from Entur's answer and the map draws it.

export type Stop = {
  name: string;
  lat: number;
  lon: number;
  aimed: string; // the departure time in the timetable
  expected: string; // the departure time Entur now expects, with delays counted in
};

export type Journey = {
  // The road, as a list of points. Like GeoJSON, each point is longitude first, then latitude.
  route: [lon: number, lat: number][];
  stops: Stop[];
};

// Entur sends the road as an "encoded polyline": thousands of points packed into one short text,
// in a format Google made for maps. Sending 2,000 points as plain numbers would take about 40,000
// characters; packed, it is about 5,000. This function unpacks it.
//
// The packing works like this: each number is the *difference* from the previous point (small,
// because the points are close together), multiplied by 100,000 and rounded to a whole number,
// then cut into pieces of 5 bits that are each written as one letter.
export function decodePolyline(text: string): Journey["route"] {
  const points: Journey["route"] = [];
  let position = 0;
  let lat = 0;
  let lon = 0;

  // Reads one number: letters are collected until one says "I am the last piece".
  function nextNumber() {
    let result = 0;
    let shift = 0;
    let piece: number;
    do {
      piece = text.charCodeAt(position++) - 63;
      result |= (piece & 0x1f) << shift; // the lowest 5 bits are the data
      shift += 5;
    } while (piece >= 0x20); // the 6th bit means "more pieces follow"
    // The lowest bit says whether the number is negative.
    return result & 1 ? ~(result >> 1) : result >> 1;
  }

  while (position < text.length) {
    lat += nextNumber();
    lon += nextNumber();
    points.push([lon / 1e5, lat / 1e5]);
  }
  return points;
}
