import type { VimeoVideo } from "./vimeo";

interface VimeoApiResponse {
  uri: string;
  name: string;
  description: string;
  tags: Array<{ uri: string; name: string; }>;
  duration: number;
  created_time: string;
  modified_time: string;
  privacy: { view: string };
  stats: { plays: number };
  metadata: {
    connections: {
      likes: { total: number };
      comments: { total: number };
      texttracks: { uri: string };
    };
  };
  pictures: {
    base_link: string;
    sizes: Array<{
      width: number;
      height: number;
      link: string;
      link_with_play_button: string;
    }>;
  };
  files: Array<{
    quality: string;
    width: number;
    height: number;
    size: number;
  }>;
  status: string;
}

export async function getEnhancedVideoDetails(
  videoId: string,
  accessToken: string
): Promise<VimeoVideo & {
  modified_time: string;
  privacy: string;
  views: number;
  likes: number;
  comments: number;
  resolution: string;
  fileSize: number;
  status: string;
  thumbnailUrl: string;
  captionsUrl: string;
}> {
  const response = await fetch(
    `https://api.vimeo.com/videos/${videoId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.vimeo.*+json;version=3.4",
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch video details: ${response.status}`);
  }

  const data = await response.json() as VimeoApiResponse;

  // Format the description - preserve line breaks but remove excess whitespace
  const formattedDescription = data.description
    ? data.description
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n')
    : '';

  // Format tags into a clean array
  const formattedTags = data.tags
    ? data.tags.map(tag => tag.name)
    : [];

  // Get highest quality file info
  const highestQualityFile = data.files?.reduce((prev, current) => {
    return (current.height > (prev?.height || 0)) ? current : prev;
  }, data.files[0]);

  // Format dates
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get the highest quality thumbnail URL
  const thumbnailUrl = data.pictures?.sizes?.reduce((prev, current) => {
    return (current.width > (prev?.width || 0)) ? current : prev;
  }, data.pictures?.sizes[0])?.link || '';

  // Generate the captions download URL
  const captionsUrl = `/api/videos/${videoId}/captions.txt`;

  return {
    id: videoId,
    uri: data.uri,
    name: data.name,
    description: formattedDescription,
    tags: formattedTags,
    duration: data.duration ? String(Math.round(data.duration / 60 * 100) / 100) : null,
    downloadUrl: null,
    embedHtml: null,
    created_time: formatDate(data.created_time),
    modified_time: data.modified_time ? formatDate(data.modified_time) : formatDate(data.created_time),
    privacy: data.privacy?.view || 'unknown',
    views: data.stats?.plays || 0,
    likes: data.metadata?.connections?.likes?.total || 0,
    comments: data.metadata?.connections?.comments?.total || 0,
    resolution: highestQualityFile ? `${highestQualityFile.width}x${highestQualityFile.height}` : 'unknown',
    fileSize: highestQualityFile ? Math.round(highestQualityFile.size / 1024 / 1024) : 0,
    status: data.status || 'unknown',
    thumbnailUrl: thumbnailUrl ? thumbnailUrl.replace('?r=pad', '/download') : '',
    captionsUrl
  };
}
