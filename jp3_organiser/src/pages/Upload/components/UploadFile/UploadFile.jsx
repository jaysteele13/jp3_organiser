import React, { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

export default function UploadFile() {
  const [files, setFiles] = useState([]);

  const selectFiles = async () => {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [
        {
          name: "Audio Files",
          extensions: ["mp3", "wav"],
        },
      ],
    });

    if (!selected) return;

    // Tauri returns string OR array of strings
    const paths = Array.isArray(selected) ? selected : [selected];

    // Save only file names (not full paths)
    const fileNames = paths.map((path) => {
      return path.split(/[/\\]/).pop();
    });

    setFiles(fileNames);
  };

  return (
    <div>
      <button onClick={selectFiles}>
        Select Audio Files
      </button>

      <ul>
        {files.map((file, index) => (
          <li key={index}>{file}</li>
        ))}
      </ul>
    </div>
  );
}
