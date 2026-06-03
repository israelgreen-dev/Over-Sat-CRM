#!/bin/bash

echo "Supabase Service Role Key Setup"
echo "--------------------------------"

ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "Creating .env.local..."
  touch "$ENV_FILE"
fi

read -p "Paste your Supabase service_role key: " SERVICE_KEY

if [ -z "$SERVICE_KEY" ]; then
  echo "Error: Service role key cannot be empty."
  exit 1
fi

if grep -q "^SUPABASE_SERVICE_ROLE_KEY=" "$ENV_FILE"; then
  sed -i.bak "s|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY|" "$ENV_FILE"
else
  echo "" >> "$ENV_FILE"
  echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY" >> "$ENV_FILE"
fi

echo ""
echo "Done. SUPABASE_SERVICE_ROLE_KEY updated in .env.local"
echo "Backup created as .env.local.bak"
echo ""
echo "Now restart your dev server:"
echo "npm run dev"
