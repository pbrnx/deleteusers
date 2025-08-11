# Bulk User Deletion for Content Server

This is a Flask web application designed to streamline the process of deleting users in bulk from an OpenText Content Server (OTCS) instance. Manually deleting multiple users can be a tedious and error-prone task. This tool provides a secure, user-friendly interface to automate this process by allowing administrators to upload a CSV file, intelligently map the data, validate it, and execute the deletion with comprehensive, real-time feedback.

## Features

* **Batch Deletion from CSV**: Greatly improves efficiency by allowing you to upload a single CSV file with all the user information needed to delete multiple users at once, saving significant time and effort.
* **Assisted Column Mapping**: The interface provides flexibility by automatically detecting columns and allowing you to map them to the required fields (username, ID) and optional ones (e-mail, origin). This means you don't need to format your CSV in a specific way.
* **Pre-execution Data Validation**: Before any deletions occur, the application validates the entire dataset. It checks for critical issues like missing required fields, duplicate user IDs within the file, and incorrect data formats, preventing common errors and ensuring data integrity.
* **Real-time Progress Tracking**: Monitor the deletion job's progress in real-time through a live-updating progress bar. This transparency is crucial for long-running jobs, giving you a clear view of what's happening at every moment.
* **Detailed Job Logging**: Every execution generates a comprehensive log file that records each successful deletion and any errors encountered. These logs are invaluable for auditing, troubleshooting, and maintaining a record of all actions performed.
* **Secure Connection**: The application prioritizes security. No operations can be performed without first establishing an authenticated session with the Content Server, ensuring that only authorized administrators can access its functionality.

## Getting Started

### Prerequisites

* Python 3.x
* Flask and other Python dependencies

### Installation & Running

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/deleteusers.git](https://github.com/your-username/deleteusers.git)
    cd deleteusers
    ```

2.  **Create a virtual environment and activate it (recommended):**
    ```bash
    # For Windows
    python -m venv venv
    .\venv\Scripts\activate

    # For macOS/Linux
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  **Install dependencies:**
    *(Note: Creating a `requirements.txt` file is a best practice. Based on the project, it would contain `Flask`, `python-dotenv`, and `requests`)*
    ```bash
    pip install Flask python-dotenv requests
    ```

4.  **Run the application:**
    ```bash
    python -m flask --app app:create_app run --debug
    ```
    Alternatively, on Windows, you can run the `exec.bat` file.

5.  Access the application by navigating to `http://127.0.0.1:5000` in your web browser.

## How to Use

1.  **Connect to Content Server**: The first step is to click the "Conectar" (Connect) button. This will open a modal where you must enter your Content Server credentials (username, password, and environment URL) to establish a secure session.
2.  **Upload CSV**: Select or drag-and-drop a `.csv` file containing the user data. A preview of the data will be shown. For convenience, a pre-formatted `template.csv` is available for download to guide you.
3.  **Map Fields**: Use the intuitive interface to map the columns from your CSV file to the application's fields. The application will attempt to auto-map common names like 'user' or 'id', but you can easily adjust the mapping using the dropdowns. `ID` and `Usuário` (Username) are required for the operation.
4.  **Validate**: Click the "Validar" (Validate) button. The tool will scan the entire file based on your mapping and display the total number of rows, along with how many are valid or invalid. This step is crucial for catching errors before execution.
5.  **Execute**: Once validation is complete and you are confident in the data, click "Executar" (Execute) to begin the bulk deletion process. The application will then start processing each valid row.
6.  **Monitor and Download Log**: Watch the progress bar advance in real-time. After the job is finished, you can download the detailed log file for the completed job. The interface also allows you to retrieve logs from previous jobs by simply entering the corresponding Job ID.

## API Endpoints

The application exposes a set of RESTful endpoints that power the frontend interface.

### Authentication

* `GET /auth/status`: Checks if a valid `otcsTicket` exists, confirming if the user is currently authenticated.
* `POST /auth/login`: Takes user credentials, attempts to authenticate with the Content Server, and securely stores the resulting session ticket.
* `POST /auth/logout`: Clears the stored session ticket, effectively logging the user out.

### Jobs

* `POST /execute`: Receives the CSV file and column mappings, creates a unique `job_id`, and starts the background deletion worker.
* `GET /jobs/<job_id>`: Retrieves a JSON object containing a snapshot of a specific job's status, including progress, counts of processed items, and current status (e.g., running, done).
* `GET /jobs/<job_id>/log`: Allows for the download of the final plain-text log file for a given job, which is useful for auditing.
* `GET /jobs/<job_id>/stream`: Uses Server-Sent Events (SSE) to push real-time progress updates to the client, enabling the live progress bar.

### Validation

* `POST /validate`: Receives the CSV file and mapping configuration and returns a JSON response with the counts of total, valid, and invalid rows.
