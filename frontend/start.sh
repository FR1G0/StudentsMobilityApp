echo "Starting frontend..."
if [ ! -d "node_modules" ]; then
    npm install
fi
# production build
npx ng build --configuration production
# start http serve with no cache
npx http-server dist/frontend/browser -p 4200 -c-1
