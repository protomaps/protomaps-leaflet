import { Benchmark } from "@feltmaps/benchmarking";
import { Static } from "protomaps";
export default class StaticMap extends Benchmark {
  async bench() {
    const map = new Static({
      url: "https://api.protomaps.com/tiles/v2/{z}/{x}/{y}.pbf?key=1003762824b9687f",
    });
    const mapContainer = document.getElementById("map-container-master");
    await map.drawCanvas(mapContainer, [37.807, -122.271], 14);
  }
}
