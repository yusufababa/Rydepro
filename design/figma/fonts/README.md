# Satoshi for Figma

These desktop font files are unpacked from the Satoshi WOFF2 files already used by this website. Their outlines, metrics, and embedded copyright information are preserved. Regular, Medium, and Bold match the website's available weights.

The web files contain placeholder internal names. The desktop copies use the distinct family **RYDEPRO Satoshi**, with corrected style names, to keep the exact website outlines without replacing an existing Satoshi installation.

If Figma reports the font as missing, select the three font files in this folder, install them, and restart Figma Desktop. The importer prefers RYDEPRO Satoshi when available, and otherwise uses an installed Satoshi family. Matching fonts preserve the design's line breaks and spacing.

Original font attribution and license reference: [website font notes](../../../assets/fonts/README.md).

To prepare these files again, run `python scripts/prepare-figma-fonts.py` from the project root. This helper uses FontTools and Node's built-in Brotli decoder.
