FROM nginx:1.29

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
