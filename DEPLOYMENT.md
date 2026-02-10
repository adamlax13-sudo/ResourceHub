# Deployment Guide for Render

This guide will help you deploy the Recovery Hub application to Render.

## Prerequisites

1. A [Render account](https://render.com) (free tier available)
2. An OpenAI API key (for AI-powered search functionality)
3. Git repository connected to Render

## Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. **Push your code to GitHub/GitLab**
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

2. **Connect to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub/GitLab repository
   - Render will automatically detect the `render.yaml` file

3. **Set Environment Variables**
   - In Render dashboard, navigate to your web service
   - Go to "Environment" tab
   - Add your OpenAI API key:
     - Key: `AI_INTEGRATIONS_OPENAI_API_KEY`
     - Value: `your-openai-api-key`

4. **Deploy**
   - Render will automatically build and deploy your application
   - Database will be created and connected automatically

### Option 2: Manual Setup

1. **Create a PostgreSQL Database**
   - In Render dashboard: New → PostgreSQL
   - Name: `recovery-hub-db`
   - Plan: Free (or Starter for production)
   - Save the connection string

2. **Create a Web Service**
   - In Render dashboard: New → Web Service
   - Connect your repository
   - Configure:
     - **Name**: `recovery-hub`
     - **Runtime**: Node
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Plan**: Free (or Starter for production)

3. **Set Environment Variables**
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `DATABASE_URL`: (paste connection string from step 1)
   - `AI_INTEGRATIONS_OPENAI_API_KEY`: (your OpenAI API key)
   - `AI_INTEGRATIONS_OPENAI_BASE_URL`: `https://api.openai.com/v1`

4. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy automatically

## Database Migrations

After deployment, you may need to push your database schema:

```bash
npm run db:push
```

Alternatively, connect to your Render PostgreSQL database and run migrations manually.

## Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://user:pass@host:5432/db` |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key for search | Yes | `sk-...` |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI API base URL | Yes | `https://api.openai.com/v1` |
| `NODE_ENV` | Environment mode | Yes | `production` |
| `PORT` | Port number (auto-set by Render) | No | `10000` |

## Monitoring

- **Logs**: View in Render dashboard → Your Service → Logs
- **Metrics**: Render dashboard → Your Service → Metrics
- **Database**: Render dashboard → recovery-hub-db

## Troubleshooting

### Build fails
- Check that all dependencies are in `package.json`
- Verify Node.js version compatibility (20+)
- Check build logs in Render dashboard

### App crashes on start
- Verify `DATABASE_URL` is set correctly
- Check that OpenAI API key is valid
- Review startup logs for errors

### Database connection issues
- Verify database is created in Render
- Check `DATABASE_URL` format
- Ensure database and web service are in the same region

## Cost Optimization

- **Free Tier**: Use free PostgreSQL (limited storage) and free web service (spins down after inactivity)
- **Paid Tier**: Upgrade to Starter plans for:
  - No spin down
  - More resources
  - Better performance
  - Larger database

## Updates

To update your deployment:

```bash
git add .
git commit -m "Update application"
git push origin main
```

Render will automatically detect changes and redeploy.

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [PostgreSQL on Render](https://render.com/docs/databases)
- [Node.js on Render](https://render.com/docs/deploy-node-express-app)
