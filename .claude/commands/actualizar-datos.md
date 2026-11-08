---
description: Descarga los datos macro más recientes y vuelve a publicar Macroeconomics
---

Actualizá los datos de Macroeconomics y republicá el artefacto:

1. Ejecutá `powershell -NoProfile -ExecutionPolicy Bypass -File tools/fetch-data.ps1` (tarda 1-2 minutos; consulta datos.gob.ar, BLS, NY Fed, US Treasury y Banco Mundial).
2. Revisá que `data/argentina.json` y `data/usa.json` tengan todos los indicadores con puntos (ninguno vacío) y mirá cuál es el último dato de cada serie. Si alguna fuente falló, avisá cuál y no publiques datos incompletos.
3. Republicá `index.html` con la herramienta Artifact, con la URL https://claude.ai/artifact/RwFJr49LKNJyQWK9tejUr6 y los mismos archivos de css/, js/ y data/ (root: la carpeta del proyecto).
4. Resumí en pocas líneas qué datos nuevos entraron (fecha del último dato de inflación, desempleo y EMAE de Argentina; CPI, desempleo y tasas de EE.UU.).

