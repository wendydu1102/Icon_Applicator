# Art2Web SVG Converter

A simple web application that allows artists to upload their drawings (JPEG, PNG, GIF) and convert them into SVG (Scalable Vector Graphics) files, suitable for use in website designs.

## Features

*   Upload JPG, PNG, GIF files.
*   Converts raster images to vector (SVG) using Potrace.
*   Previews the original uploaded image.
*   Previews the generated SVG.
*   Provides the SVG code for copying.
*   Allows downloading the generated SVG file.
*   Drag and drop file upload.

## Prerequisites

*   Python 3.7+
*   Flask (`pip install Flask`)
*   Pillow (`pip install Pillow`)
*   Potrace command-line tool (must be installed and in your system's PATH)
    *   Linux (Debian/Ubuntu): `sudo apt-get install potrace`
    *   macOS (Homebrew): `brew install potrace`
    *   Windows: Download from [potrace.sourceforge.net](http://potrace.sourceforge.net/) and add to PATH.

## Setup

1.  Clone this repository or download the files.
2.  Create the necessary directories (if not present):
    ```bash
    mkdir -p static/css static/js templates uploads processed