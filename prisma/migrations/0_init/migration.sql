-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('UNKNOWN', 'ONLINE', 'OFFLINE', 'CHECKING');

-- CreateEnum
CREATE TYPE "ProxyProtocol" AS ENUM ('VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HTTPS', 'HTTP', 'TCP');

-- CreateEnum
CREATE TYPE "VpnUserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'EXPIRY', 'HEALTH', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "HealthTarget" AS ENUM ('SERVER', 'ENDPOINT', 'PORT', 'DATABASE', 'API', 'FAILOVER');

-- CreateEnum
CREATE TYPE "FailoverState" AS ENUM ('NOT_CHECKED', 'CONFIGURED', 'HEALTHY', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "prefs" JSONB NOT NULL DEFAULT '{}',
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Server" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "ip" TEXT,
    "provider" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "status" "ResourceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "latencyMs" INTEGER,
    "lastCheckAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endpoint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" "ProxyProtocol" NOT NULL,
    "tls" BOOLEAN NOT NULL DEFAULT true,
    "sni" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "ResourceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "latencyMs" INTEGER,
    "lastCheckAt" TIMESTAMP(3),
    "lastError" TEXT,
    "serverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Endpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Port" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "protocol" "ProxyProtocol" NOT NULL,
    "tls" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "status" "ResourceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "latencyMs" INTEGER,
    "lastCheckAt" TIMESTAMP(3),
    "serverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Port_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "status" "VpnUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "protocol" "ProxyProtocol" NOT NULL,
    "credentials" JSONB,
    "config" TEXT,
    "configUpdatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "trafficLimitBytes" BIGINT,
    "usedBytes" BIGINT NOT NULL DEFAULT 0,
    "notes" TEXT,
    "serverId" TEXT,
    "endpointId" TEXT,
    "portId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "protocol" "ProxyProtocol" NOT NULL,
    "content" TEXT NOT NULL,
    "vpnUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudflareAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Cloudflare',
    "tokenCipher" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "accountId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudflareAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudflareZone" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "records" JSONB,
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudflareZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrafficRecord" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vpnUserId" TEXT,
    "serverId" TEXT,
    "endpointId" TEXT,
    "bytesIn" BIGINT NOT NULL DEFAULT 0,
    "bytesOut" BIGINT NOT NULL DEFAULT 0,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'ingest',

    CONSTRAINT "TrafficRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "source" TEXT NOT NULL DEFAULT 'api',
    "message" TEXT,
    "meta" JSONB,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogEntry" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "userId" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "message" TEXT NOT NULL,
    "ip" TEXT,
    "meta" JSONB,

    CONSTRAINT "LogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "dedupeKey" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '["traffic:ingest"]',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FailoverRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryEndpointId" TEXT NOT NULL,
    "backupEndpointId" TEXT NOT NULL,
    "checkIntervalSec" INTEGER NOT NULL DEFAULT 60,
    "failureThreshold" INTEGER NOT NULL DEFAULT 3,
    "recoveryThreshold" INTEGER NOT NULL DEFAULT 2,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "state" "FailoverState" NOT NULL DEFAULT 'NOT_CHECKED',
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "consecutiveSuccesses" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "lastNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FailoverRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" TEXT NOT NULL,
    "target" "HealthTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "latencyMs" INTEGER,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "ip" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Server_name_key" ON "Server"("name");

-- CreateIndex
CREATE INDEX "Server_status_idx" ON "Server"("status");

-- CreateIndex
CREATE INDEX "Endpoint_serverId_idx" ON "Endpoint"("serverId");

-- CreateIndex
CREATE INDEX "Endpoint_status_idx" ON "Endpoint"("status");

-- CreateIndex
CREATE INDEX "Port_status_idx" ON "Port"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Port_serverId_number_protocol_key" ON "Port"("serverId", "number", "protocol");

-- CreateIndex
CREATE UNIQUE INDEX "VpnUser_username_key" ON "VpnUser"("username");

-- CreateIndex
CREATE INDEX "VpnUser_status_idx" ON "VpnUser"("status");

-- CreateIndex
CREATE INDEX "VpnUser_expiresAt_idx" ON "VpnUser"("expiresAt");

-- CreateIndex
CREATE INDEX "VpnUser_serverId_idx" ON "VpnUser"("serverId");

-- CreateIndex
CREATE INDEX "Config_vpnUserId_idx" ON "Config"("vpnUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CloudflareAccount_tokenHash_key" ON "CloudflareAccount"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "CloudflareZone_zoneId_key" ON "CloudflareZone"("zoneId");

-- CreateIndex
CREATE INDEX "CloudflareZone_accountId_idx" ON "CloudflareZone"("accountId");

-- CreateIndex
CREATE INDEX "TrafficRecord_at_idx" ON "TrafficRecord"("at");

-- CreateIndex
CREATE INDEX "TrafficRecord_vpnUserId_idx" ON "TrafficRecord"("vpnUserId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_at_idx" ON "AnalyticsEvent"("at");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_type_idx" ON "AnalyticsEvent"("type");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_type_at_idx" ON "AnalyticsEvent"("type", "at");

-- CreateIndex
CREATE INDEX "LogEntry_at_idx" ON "LogEntry"("at");

-- CreateIndex
CREATE INDEX "LogEntry_level_idx" ON "LogEntry"("level");

-- CreateIndex
CREATE INDEX "LogEntry_action_idx" ON "LogEntry"("action");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_createdById_idx" ON "ApiKey"("createdById");

-- CreateIndex
CREATE INDEX "FailoverRule_enabled_idx" ON "FailoverRule"("enabled");

-- CreateIndex
CREATE INDEX "HealthCheck_targetId_checkedAt_idx" ON "HealthCheck"("targetId", "checkedAt");

-- CreateIndex
CREATE INDEX "HealthCheck_checkedAt_idx" ON "HealthCheck"("checkedAt");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endpoint" ADD CONSTRAINT "Endpoint_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Port" ADD CONSTRAINT "Port_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnUser" ADD CONSTRAINT "VpnUser_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnUser" ADD CONSTRAINT "VpnUser_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnUser" ADD CONSTRAINT "VpnUser_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnUser" ADD CONSTRAINT "VpnUser_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Config" ADD CONSTRAINT "Config_vpnUserId_fkey" FOREIGN KEY ("vpnUserId") REFERENCES "VpnUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudflareZone" ADD CONSTRAINT "CloudflareZone_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CloudflareAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficRecord" ADD CONSTRAINT "TrafficRecord_vpnUserId_fkey" FOREIGN KEY ("vpnUserId") REFERENCES "VpnUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailoverRule" ADD CONSTRAINT "FailoverRule_primaryEndpointId_fkey" FOREIGN KEY ("primaryEndpointId") REFERENCES "Endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailoverRule" ADD CONSTRAINT "FailoverRule_backupEndpointId_fkey" FOREIGN KEY ("backupEndpointId") REFERENCES "Endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

