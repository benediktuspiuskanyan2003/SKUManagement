#!/bin/sh
source .venv/bin/activate
# Jalankan server Flask dengan argumen yang diurutkan dengan benar
python -u -m flask --app main run --debug -p ${PORT:-8080}
