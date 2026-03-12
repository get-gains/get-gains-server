Step-by-Step: Build Locally & Deploy to Railway via Docker Hub
1. Build the Docker Image Locally

```
cd D:\get-gains\get-gains-server
docker build -t get-gains-server .
```

2. Tag for Docker Hub
Replace yourusername with your Docker Hub username:

```
docker tag get-gains-server yourusername/get-gains-server:latest
```

3. Login to Docker Hub

```
docker login
```

4. Push to Docker Hub

```
docker push yourusername/get-gains-server:latest
```

5. Deploy to Railway from Docker Hub

Go to railway.app → Your project
Click + New → Docker Image
Enter: yourusername/get-gains-server:latest
Click Deploy