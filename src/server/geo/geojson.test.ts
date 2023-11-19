import { expect, test } from "vitest";
import { unifySegments } from "./geojson";

test("unifySegments", () => {
  const pointCount = ROAD_SEGMENTS.flat().length;
  const joinedSegments = unifySegments(ROAD_SEGMENTS);

  expect(joinedSegments.length).toBe(1);
  // Overlapped points are trimmed
  expect(joinedSegments.flat().length).toBe(
    pointCount - ROAD_SEGMENTS.length + joinedSegments.length,
  );
});

const ROAD_SEGMENTS = [
  [
    [-73.6858712, 42.7396724],
    [-73.685619, 42.739664],
    [-73.685452, 42.739658],
    [-73.6853745, 42.739654],
    [-73.685066, 42.739636],
    [-73.684759, 42.739636],
    [-73.6840979, 42.7396305],
    [-73.6837389, 42.7396362],
    [-73.683559, 42.739639],
    [-73.6831146, 42.73964],
  ],
  [
    [-73.6816564, 42.7396174],
    [-73.681366, 42.7396107],
    [-73.680717, 42.739578],
    [-73.67975, 42.739528],
  ],
  [
    [-73.6585038, 42.7395171],
    [-73.6584473, 42.7395429],
    [-73.6581764, 42.7396641],
    [-73.65811357362382, 42.739691594569535],
  ],
  [
    [-73.67975, 42.739528],
    [-73.6792473, 42.7394928],
  ],
  [
    [-73.670074, 42.7382677],
    [-73.669279, 42.738165],
    [-73.6692248, 42.7381575],
    [-73.6690087, 42.7381274],
    [-73.6683879, 42.7380411],
    [-73.6682157, 42.7380172],
    [-73.668049, 42.737994],
    [-73.667772, 42.737952],
    [-73.666975, 42.737833],
    [-73.666556, 42.73777],
    [-73.666061, 42.737699],
    [-73.665415, 42.737601],
    [-73.665086, 42.737576],
    [-73.664671, 42.737557],
    [-73.6645214, 42.7375618],
    [-73.66442, 42.737565],
    [-73.6644152, 42.7375654],
    [-73.6643709, 42.7375691],
    [-73.663684, 42.737626],
    [-73.663304, 42.737688],
    [-73.663056, 42.737758],
    [-73.661752, 42.738184],
    [-73.661174, 42.738368],
    [-73.660687, 42.73853],
    [-73.660471, 42.73861],
    [-73.660251, 42.738715],
    [-73.660103, 42.73878],
    [-73.659781, 42.738925],
    [-73.6592826, 42.7391575],
    [-73.6590954, 42.7392471],
  ],
  [
    [-73.6831146, 42.73964],
    [-73.6818857, 42.7396218],
    [-73.6816564, 42.7396174],
  ],
  [
    [-73.6792473, 42.7394928],
    [-73.6791958, 42.7394892],
    [-73.678922, 42.73947],
    [-73.677979, 42.73939],
    [-73.677421, 42.739324],
    [-73.6771468, 42.7392905],
    [-73.676937, 42.7392618],
    [-73.6768462, 42.7392494],
    [-73.6767379, 42.7392338],
    [-73.6765489, 42.7392066],
    [-73.6760166, 42.7391287],
    [-73.6757565, 42.7390906],
    [-73.675582, 42.739065],
    [-73.6755281, 42.7390571],
    [-73.6753337, 42.7390285],
    [-73.6750166, 42.7389818],
    [-73.6748979, 42.7389634],
    [-73.6748008, 42.7389504],
    [-73.6746498, 42.7389287],
    [-73.673953, 42.7388288],
    [-73.673783, 42.738804],
    [-73.6735528, 42.7387703],
    [-73.6734875, 42.7387608],
    [-73.673014, 42.738695],
    [-73.672853, 42.738671],
    [-73.672477, 42.7386164],
    [-73.671065, 42.7384115],
    [-73.6709132, 42.7383896],
    [-73.670074, 42.7382677],
  ],
  [
    [-73.6587221, 42.7394172],
    [-73.6585038, 42.7395171],
  ],
  [
    [-73.6590954, 42.7392471],
    [-73.6589637, 42.7393067],
    [-73.6587221, 42.7394172],
  ],
];
