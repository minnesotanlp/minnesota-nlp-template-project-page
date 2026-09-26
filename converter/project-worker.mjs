// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  readArchive,
  mainDocuments,
  suggestedEngine,
  prepareProject,
} from "./project.mjs";

let project;
self.onmessage = ({ data }) => {
  try {
    if (data.action === "inspect") {
      project = readArchive(new Uint8Array(data.archive));
      const mains = mainDocuments(project);
      if (!mains.length)
        throw new Error(
          "No main document found. Include a UTF-8 .tex file with \\documentclass and \\begin{document}, along with its supporting files.",
        );
      self.postMessage({
        id: data.id,
        mains,
        count: project.size,
        engines: Object.fromEntries(
          mains.map((path) => [path, suggestedEngine(project, path)]),
        ),
      });
    } else if (data.action === "prepare") {
      if (!project) throw new Error("Choose your ZIP again.");
      const overlay = readArchive(new Uint8Array(data.overlay));
      const result = prepareProject(project, data.main, data.mode, overlay);
      self.postMessage({ id: data.id, ...result }, [result.archive.buffer]);
    }
  } catch (error) {
    self.postMessage({
      id: data.id,
      error: error.message || "The project could not be prepared.",
    });
  }
};
