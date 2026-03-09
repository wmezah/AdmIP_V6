# SpareTrack — Sistema de Gestión de Spares

Stack completo: **Django REST Framework** (backend) + **React + Vite + Tailwind** (frontend).

---

## 🚀 Arranque rápido

### Backend (Django)

```bash
cd backend
pip install -r requirements.txt

# Configurar base de datos en .env
cp .env.example .env
# Editar .env con tus credenciales MySQL

python manage.py migrate
python manage.py createsuperuser   # opcional
python manage.py runserver         # → http://localhost:8000
```

### Frontend (React)

```bash
cd frontend
npm install
npm run dev    # → http://localhost:5173
```

> El proxy Vite redirige `/api/*` → `http://localhost:8000` automáticamente.

---

## 🗄️ Variables de entorno (`backend/.env`)

```
SECRET_KEY=django-insecure-change-me
DEBUG=True
DB_NAME=spare_tracker
DB_USER=root
DB_PASSWORD=
DB_HOST=localhost
DB_PORT=3306
```

---

## 📁 Estructura

```
spare-tracker/
├── backend/
│   ├── config/          ← settings, urls, wsgi
│   ├── spare/
│   │   ├── models.py    ← Spare, SAPCatalog, CentroAlmacen, SAPMaterial
│   │   ├── serializers.py
│   │   ├── views.py     ← ViewSets + importación
│   │   ├── filters.py
│   │   ├── urls.py
│   │   └── migrations/
│   ├── manage.py
│   └── requirements.txt
└── frontend/
    ├── public/
    │   └── sap_catalog.json     ← 48,461 registros SAP (para búsqueda local)
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   │   ├── Sidebar.jsx
    │   │   ├── Topbar.jsx
    │   │   └── StatusBadge.jsx
    │   ├── pages/
    │   │   ├── Dashboard.jsx    ← KPIs + gráficas Recharts
    │   │   ├── SpareList.jsx    ← CRUD con autocompletado SAP
    │   │   ├── CatalogPage.jsx  ← Catálogo SAP + Centros/Almacenes
    │   │   └── ImportPage.jsx   ← Carga masiva CSV / Excel
    │   └── services/api.js      ← Axios para todos los endpoints
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.js
```

---

## 🔌 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET/POST | `/api/spare/items/` | Listar / crear Spares |
| GET/PATCH/DELETE | `/api/spare/items/{id}/` | Detalle, editar, eliminar |
| GET | `/api/spare/items/filter-options/` | Opciones para filtros |
| GET | `/api/spare/items/export-csv/` | Exportar CSV |
| GET/POST | `/api/spare/sap-catalog/` | Catálogo SAP |
| GET | `/api/spare/sap-catalog/lookup/?sap=XXXX` | Buscar por código |
| POST | `/api/spare/sap-catalog/bulk-import/` | Importar Excel SAP |
| GET/POST | `/api/spare/centros/` | Centros / Almacenes |
| GET | `/api/spare/centros/centros/` | Lista de centros únicos |
| GET | `/api/spare/centros/by-centro/?centro=P008` | Almacenes de un centro |
| GET | `/api/spare/dashboard/stats/` | KPIs del dashboard |
| GET | `/api/spare/dashboard/timeline/` | Ingresos por mes |
| POST | `/api/spare/import/csv/` | Importar Spares CSV |
| POST | `/api/spare/import/xlsx/` | Importar SAP MM Excel |

---

## ✨ Funcionalidades clave

- **Autocompletado SAP**: Al escribir el código SAP en el formulario, se busca en tiempo real entre los 48k registros del catálogo y se autocompletan todos los campos del material.
- **Centro / Almacén enlazados**: Al seleccionar Centro el combo de Almacén filtra automáticamente.
- **Catálogo SAP editable**: Tabla con todos los campos del Excel SAP MM, con búsqueda, paginación, edición inline y carga masiva desde Excel.
- **Dashboard**: KPIs, gráfica de torta por estatus, barras por tipo y línea de ingresos por mes.
- **Importación masiva**: Drop-zone para CSV de Spares y Excel SAP MM.
- **Exportar CSV**: Descarga el inventario filtrado.
