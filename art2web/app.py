import os
import uuid
import subprocess
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
from PIL import Image

# Configuration
UPLOAD_FOLDER = 'uploads'
PROCESSED_FOLDER = 'processed'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['PROCESSED_FOLDER'] = PROCESSED_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Ensure upload and processed directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def convert_to_svg(image_path, svg_path):
    """
    Converts an image to SVG using Potrace.
    Requires Potrace to be installed and in the system PATH.
    Intermediate BMP file is created as Potrace works well with it.
    """
    try:
        # Generate a temporary BMP path
        base_name = os.path.splitext(os.path.basename(image_path))[0]
        bmp_temp_path = os.path.join(app.config['PROCESSED_FOLDER'], f"{base_name}_temp.bmp")

        # Convert image to BMP using Pillow
        img = Image.open(image_path)
        
        # Potrace works best with bilevel (1-bit) images.
        # Convert to grayscale first, then to 1-bit black and white.
        # If the image has transparency (e.g., PNG), handle it by pasting onto a white background.
        if img.mode == 'RGBA' or img.mode == 'LA' or (img.mode == 'P' and 'transparency' in img.info):
            # Create a white background image
            background = Image.new('RGB', img.size, (255, 255, 255))
            # Paste the image onto the white background using its alpha channel as mask
            background.paste(img, (0, 0), img.convert('RGBA'))
            img = background
            
        img = img.convert('L') # Convert to grayscale
        img = img.convert('1', dither=Image.NONE) # Convert to 1-bit black and white, no dithering for cleaner lines
        img.save(bmp_temp_path)

        # Run Potrace
        # -s: SVG output
        # -o svg_path: output file
        # --progress: show progress (optional, might clutter logs)
        # Add other potrace options here if needed, e.g., --turdsize to remove speckles
        # Potrace command: potrace <input_bmp> -s -o <output_svg>
        process = subprocess.run(
            ['potrace', bmp_temp_path, '-s', '-o', svg_path, '--turdsize', '2'],
            capture_output=True, text=True, check=True
        )
        
        # Clean up temporary BMP file
        if os.path.exists(bmp_temp_path):
            os.remove(bmp_temp_path)
            
        return True
    except FileNotFoundError:
        app.logger.error("Potrace command not found. Ensure it's installed and in PATH.")
        # Clean up temp bmp if it exists
        if os.path.exists(bmp_temp_path):
            os.remove(bmp_temp_path)
        raise Exception("SVG conversion tool (Potrace) not found on the server.")
    except subprocess.CalledProcessError as e:
        app.logger.error(f"Potrace failed: {e.stderr}")
        # Clean up temp bmp if it exists
        if os.path.exists(bmp_temp_path):
            os.remove(bmp_temp_path)
        raise Exception(f"Error during SVG conversion: {e.stderr}")
    except Exception as e:
        app.logger.error(f"Error in convert_to_svg: {str(e)}")
        # Clean up temp bmp if it exists (check again in case it was defined)
        if 'bmp_temp_path' in locals() and os.path.exists(bmp_temp_path):
            os.remove(bmp_temp_path)
        raise Exception(f"An unexpected error occurred during image processing: {str(e)}")


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/convert', methods=['POST'])
def convert_image():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        original_filename = secure_filename(file.filename)
        unique_id = uuid.uuid4().hex
        
        # Save original uploaded file
        original_extension = original_filename.rsplit('.', 1)[1].lower()
        saved_filename = f"{unique_id}.{original_extension}"
        original_path = os.path.join(app.config['UPLOAD_FOLDER'], saved_filename)
        file.save(original_path)

        # Prepare path for SVG
        svg_filename = f"{unique_id}.svg"
        svg_path = os.path.join(app.config['PROCESSED_FOLDER'], svg_filename)

        try:
            conversion_success = convert_to_svg(original_path, svg_path)
            if conversion_success:
                with open(svg_path, 'r', encoding='utf-8') as f:
                    svg_data = f.read()
                
                # Optionally, clean up original uploaded file and processed SVG after sending
                # For now, we keep them for potential download or inspection
                # os.remove(original_path)
                # os.remove(svg_path) # if svg_data is enough

                return jsonify({
                    'success': True, 
                    'svg_data': svg_data,
                    'svg_filename': svg_filename # For creating a download link if served statically
                })
            else:
                # This case should ideally be caught by exceptions in convert_to_svg
                return jsonify({'success': False, 'error': 'SVG conversion failed for an unknown reason.'}), 500

        except Exception as e:
            app.logger.error(f"Conversion process error: {str(e)}")
            # Clean up original file if conversion fails badly
            if os.path.exists(original_path):
                os.remove(original_path)
            if os.path.exists(svg_path): # If SVG was partially created or failed
                os.remove(svg_path)
            return jsonify({'success': False, 'error': str(e)}), 500
        
    else:
        return jsonify({'success': False, 'error': 'File type not allowed'}), 400

# This route is optional if you embed SVG data directly or use data URI.
# If you want to provide a direct download link to a server-stored file:
@app.route('/download_svg/<filename>')
def download_svg(filename):
    return send_from_directory(app.config['PROCESSED_FOLDER'], filename, as_attachment=True)


if __name__ == '__main__':
    # For development: app.run(debug=True)
    # For production, use a proper WSGI server like Gunicorn or Waitress
    app.run(debug=True, host='0.0.0.0', port=5000)