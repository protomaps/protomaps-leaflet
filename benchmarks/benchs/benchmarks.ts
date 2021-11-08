import { BenchmarkingSuite } from "@feltmaps/benchmarking";
import StaticLocal from "./staticLocal";
import StaticMaster from "./staticMaster";

const suite = new BenchmarkingSuite();
suite.register("Static map", "local", new StaticLocal());
suite.register("Static map", "master", new StaticMaster());
suite.run();
