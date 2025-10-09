<img alt="BHIDAPA" src="/logo.svg" width="65" />

# Web

This GitHub repository serves as the central codebase for the entire online presence of [BHIDAPA](https://bhidapa.ba/). It contains the source code, custom themes, plugins, and configuration files necessary to run and maintain all affiliated websites, ensuring consistent development and deployment across the organization's digital platforms.

The infrastructure is built on a modern, high-performance containerized architecture. It uses modern [WordPress](https://wordpress.org/) with [Gutenberg blocks](https://wordpress.org/gutenberg/) powered by [FrankenPHP](https://frankenphp.dev/) and fronted by [Caddy](https://caddyserver.com/). The repository utilizes [Bun](https://bun.com/) for building the blocks and all other necessary tooling and scripting.

This codebase manages the following websites:

- [BHIDAPA](https://bhidapa.ba/en/)
- [Academy of Psychotherapy](https://akp.ba/en/)
- [Congress](https://congress.bhidapa.ba/)
- [Journal](https://journal.bhidapa.ba/) (not WordPress, managing only infra)

## Gotchas

### The REST API encountered an error

When developing locally with docker compose, your WordPress Site Health Status will show that the REST API is encountering errors.

This is because the check is performed using curl from the `fpm` service on `localhost:58386` trying to reach `nginx`, but it's actually available only on `nginx:80` in Docker's network.

The failing health check can be safely ignore because when the website is deployed, WordPress site URL will be correct and the REST API accessible.

## Cheatsheet

### ssh into the wp container

> [!TIP]
> Has [wp-cli](https://wp-cli.org/) installed. Note that you have to set the `WORDPRESS_DB_*` variables for the desired website.

```sh
aws ecs execute-command \
  --region eu-central-1 \
  --cluster <project>-<stack>-wp \
  --task <task-id> \
  --container wp \
  --command 'su -l www-data -s /bin/bash' \
  --interactive
```

### ssh into the jump server

> [!TIP]
> Use `wp-mysql` to connect to the RDS database.
>
> The EFS drive is mounted under `/mnt/efs`.

```sh
ssh -i jump-server.pem ec2-user@<jump-server-endpoint>
```
