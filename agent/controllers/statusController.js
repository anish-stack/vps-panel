const si = require('systeminformation');

/**
 * GET /status
 * Returns CPU, RAM, Disk, uptime
 */
const getStatus = async (req, res) => {
  try {
    const [cpu, cpuLoad, mem, disk, osInfo, time] = await Promise.all([
      si.cpu(),
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.osInfo(),
      si.time(),
    ]);

    // Filter to main disk(s) only
    const mainDisks = disk.filter(d => d.size > 0).map(d => ({
      fs: d.fs,
      mount: d.mount,
      size: d.size,
      used: d.used,
      available: d.available,
      usePercent: d.use,
    }));

    res.json({
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        loadPercent: Math.round(cpuLoad.currentLoad * 100) / 100,
        loadPerCore: cpuLoad.cpus?.map(c => Math.round(c.load * 100) / 100) || [],
      },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        available: mem.available,
        usePercent: Math.round((mem.used / mem.total) * 10000) / 100,
        swapTotal: mem.swaptotal,
        swapUsed: mem.swapused,
      },
      disk: mainDisks,
      os: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        hostname: osInfo.hostname,
        arch: osInfo.arch,
      },
      uptime: {
        seconds: time.uptime,
        bootTime: time.current - time.uptime * 1000,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({ error: 'Failed to collect system info' });
  }
};

module.exports = { getStatus };
