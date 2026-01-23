# Use the official Redis Alpine image
FROM redis:alpine

# Expose Redis default port
EXPOSE 6379

# Use the default Redis configuration
# Data will be persisted in /data directory
VOLUME ["/data"]

# Start Redis server
CMD ["redis-server"]
