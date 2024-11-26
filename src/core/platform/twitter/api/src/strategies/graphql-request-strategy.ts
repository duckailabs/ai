// graphql-request-strategy.ts

import { TwitterError } from "../error";
import {
  type Poll,
  type Profile,
  type SearchOptions,
  type Tweet,
  type TweetOptions,
} from "../interfaces";
import { MediaUploader } from "../media";
import { BaseRequestStrategy, type RequestResponse } from "./request-strategy";

export class GraphQLRequestStrategy extends BaseRequestStrategy {
  private readonly graphqlUrl = "https://x.com/i/api/graphql";
  private mediaUploader: MediaUploader;

  constructor(headers: () => Promise<Record<string, string>>) {
    super(headers);
    this.mediaUploader = new MediaUploader(headers);
  }

  private readonly queryIds = {
    createTweet: "a1p9RWpkYKBjWv_I3WzS-A",
    getTweet: "xOhkmRac04YFZmOzU9PJHg",
    likeTweet: "lI07N6Otwv1PhnEgXILM7A",
    retweet: "ojPdsZsimiJrUGLR1sjUtA",
    searchTweets: "gkjsKepM6gl_HmFWoWKfgg",
    getUser: "G3KGOASz96M-Qu0nwmGXNg",
    getUserTweets: "E3opETHurmVJflFsUBVuUQ",
    followUser: "UoqsuUVNGg0jyKGggb6eHQ",
    noteTweet: "3Wu3Na3lrBzHKWJylOmaSg",
  };

  private readonly endpoints = {
    createTweet: `${this.queryIds.createTweet}/CreateTweet`,
    getTweet: `${this.queryIds.getTweet}/TweetDetail`,
    likeTweet: `${this.queryIds.likeTweet}/FavoriteTweet`,
    retweet: `${this.queryIds.retweet}/CreateRetweet`,
    searchTweets: `${this.queryIds.searchTweets}/SearchTimeline`,
    getUser: `${this.queryIds.getUser}/UserByScreenName`,
    getUserTweets: `${this.queryIds.getUserTweets}/UserTweets`,
    followUser: `${this.queryIds.followUser}/Follow`,
    createNoteTweet: `${this.queryIds.noteTweet}/CreateNoteTweet`,
  };

  protected getFollowUserFeatures() {
    return {
      // Features from error message
      freedom_of_speech_not_reach_fetch_enabled: true,
      tweetypie_unmention_optimization_enabled: true,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      view_counts_everywhere_api_enabled: true,
      responsive_web_media_download_video_enabled: false,
      longform_notetweets_rich_text_read_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:
        true,
      standardized_nudges_misinfo: true,
      longform_notetweets_inline_media_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: false,
      responsive_web_enhance_cards_enabled: false,

      // Original features we had
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      hidden_profile_subscriptions_enabled: true,
      highlights_tweets_tab_ui_enabled: true,
      hidden_profile_likes_enabled: true,
      subscriptions_verification_info_verified_since_enabled: true,
      subscriptions_verification_info_is_identity_verified_enabled: true,
    };
  }

  protected getCreateNoteTweetFeatures() {
    return {
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      articles_preview_enabled: true,
      rweb_video_timestamps_enabled: true,
      rweb_tipjar_consumption_enabled: true,
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:
        true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_enhance_cards_enabled: false,
    };
  }

  protected getCreateTweetFeatures() {
    return {
      interactive_text_enabled: true,
      responsive_web_text_conversations_enabled: false,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:
        false,
      vibe_api_enabled: false,
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      responsive_web_twitter_article_tweet_consumption_enabled: false,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      longform_notetweets_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      view_counts_everywhere_api_enabled: true,
      tweetypie_unmention_optimization_enabled: true,
      standardized_nudges_misinfo: true,
      rweb_video_timestamps_enabled: true,
      responsive_web_enhance_cards_enabled: false,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      responsive_web_media_download_video_enabled: false,
    };
  }
  protected getProfileFeatures() {
    return {
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: true,
      highlights_tweets_tab_ui_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      creator_subscriptions_tweet_preview_api_enabled: true,
      subscriptions_verification_info_verified_since_enabled: true,
      hidden_profile_likes_enabled: true,
      subscriptions_verification_info_is_identity_verified_enabled: true,
      verified_phone_label_enabled: false,
      responsive_web_graphql_exclude_directive_enabled: true,
      hidden_profile_subscriptions_enabled: true,
    };
  }

  private getGetTweetFeatures() {
    return {
      ...this.getCreateTweetFeatures(),
      responsive_web_media_download_video_enabled: false,
      responsive_web_twitter_article_tweet_consumption_enabled: false,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:
        true,
      longform_notetweets_inline_media_enabled: false,
      responsive_web_enhance_cards_enabled: false,
      unified_cards_ad_metadata_container_dynamic_card_content_query_enabled:
        false,
      creator_subscriptions_tweet_preview_api_enabled: false,
      c9s_tweet_anatomy_moderator_badge_enabled: false,
    };
  }

  private getSearchTweetsFeatures() {
    return {
      tweetypie_unmention_optimization_enabled: true,
      freedom_of_speech_not_reach_fetch_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      responsive_web_graphql_exclude_directive_enabled: true,
      vibe_api_enabled: false,
      longform_notetweets_consumption_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      verified_phone_label_enabled: false,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: true,
      interactive_text_enabled: true,
      responsive_web_text_conversations_enabled: false,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:
        true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      standardized_nudges_misinfo: true,
      view_counts_everywhere_api_enabled: true,
      responsive_web_enhance_cards_enabled: false,
      blue_business_profile_image_shape_enabled: false,
    };
  }

  async sendTweet(
    text: string,
    options?: TweetOptions
  ): Promise<RequestResponse<Tweet>> {
    const headers = await this.headers();

    let mediaIds: string[] = [];
    if (options?.media?.length) {
      mediaIds = await Promise.all(
        options.media.map(async (media) => {
          const result = await this.mediaUploader.uploadMedia(
            media.data,
            media.type
          );
          return result.mediaId;
        })
      );
    }

    const isLongform = text.length > 280;
    if (options?.poll) {
      console.log("Poll detected");
    }

    const variables = {
      tweet_text: text,
      dark_request: false,
      media: mediaIds.length
        ? {
            media_entities: mediaIds.map((id) => ({ media_id: id })),
            possibly_sensitive: false,
          }
        : undefined,
      reply: options?.replyToTweet
        ? {
            in_reply_to_tweet_id: options.replyToTweet,
            exclude_reply_user_ids: [],
          }
        : undefined,
      quote_tweet_id: options?.quoteTweet,
      card_uri: "",
    };

    if (options?.poll) {
      // Create poll first
      const pollResponse = await this.createPoll({
        text,
        choices: options.poll.options.map((o) => o.label),
        duration_minutes: options.poll.duration_minutes,
      });

      // Add card_uri to variables
      variables.card_uri = pollResponse.data;
    }

    if (isLongform) {
      const response = await this.makeRequest(
        `${this.graphqlUrl}/${this.endpoints.createNoteTweet}`,
        "POST",
        {
          variables: JSON.stringify(variables),
          features: JSON.stringify(this.getCreateNoteTweetFeatures()),
        }
      );
      return this.parseTweetResponse(response);
    } else {
      const response = await this.makeRequest(
        `${this.graphqlUrl}/${this.endpoints.createTweet}`,
        "POST",
        {
          variables: JSON.stringify(variables),
          features: JSON.stringify({
            ...this.getCreateTweetFeatures(),
          }),
          queryId: this.queryIds.createTweet,
        }
      );

      return this.parseTweetResponse(response);
    }
  }

  async getProfile(username: string): Promise<RequestResponse<Profile>> {
    const variables = {
      screen_name: username,
      withSafetyModeUserFields: true,
    };

    const features = this.getProfileFeatures();
    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(features),
    });

    const response = await this.makeRequest(
      `${this.graphqlUrl}/${this.endpoints.getUser}?${params.toString()}`
    );

    return this.parseProfileResponse(response);
  }

  async getTweet(id: string): Promise<RequestResponse<Tweet>> {
    // For GET requests, add params to URL instead of body
    const variables = {
      focalTweetId: id,
      withHighlightedLabel: true,
      withVoice: true,
      withV2Timeline: true,
      includePromotedContent: false,
      withBirdwatchNotes: false,
    };

    const features = this.getGetTweetFeatures();

    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(features),
      fieldToggles: JSON.stringify({ withArticleRichContentState: false }),
    });

    const url = `${this.graphqlUrl}/${
      this.endpoints.getTweet
    }?${params.toString()}`;

    const response = await this.makeRequest(url, "GET");

    return this.parseTweetResponse(response);
  }
  async searchTweets(
    query: string,
    options?: SearchOptions
  ): Promise<RequestResponse<Tweet[]>> {
    const variables = {
      rawQuery: query,
      count: options?.maxTweets || 20,
      product: options?.searchMode || "Top",
      querySource: "typed_query",
      includePromotedContent: false,
      cursor: options?.cursor,
    };

    const features = this.getSearchTweetsFeatures();
    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(features),
    });

    const url = `${this.graphqlUrl}/${
      this.endpoints.searchTweets
    }?${params.toString()}`;

    const response = await this.makeRequest(url, "GET");

    return this.parseSearchResponse(response);
  }

  async likeTweet(tweetId: string): Promise<RequestResponse<void>> {
    await this.makeRequest(
      `${this.graphqlUrl}/${this.endpoints.likeTweet}`,
      "POST",
      { variables: JSON.stringify({ tweet_id: tweetId }) }
    );
    return { data: undefined };
  }

  async retweet(tweetId: string): Promise<RequestResponse<void>> {
    await this.makeRequest(
      `${this.graphqlUrl}/${this.endpoints.retweet}`,
      "POST",
      { variables: JSON.stringify({ tweet_id: tweetId }) }
    );
    return { data: undefined };
  }

  async createQuoteTweet(
    tweetId: string,
    text: string
  ): Promise<RequestResponse<Tweet>> {
    return this.sendTweet(text, { quoteTweet: tweetId });
  }

  async followUser(username: string): Promise<RequestResponse<void>> {
    // First get the user ID using the existing getProfile method
    const userResponse = await this.getProfile(username);
    if (!userResponse.data?.id) {
      throw new TwitterError(404, "User not found");
    }

    const userId = userResponse.data.id;

    // Use the correct endpoint
    const followUrl = "https://twitter.com/i/api/1.1/friendships/create.json";

    // Get base headers
    const headers = await this.headers();

    // Prepare form data
    const formData = new URLSearchParams({
      user_id: userId,
      include_profile_interstitial_type: "1",
      skip_status: "true",
    });

    try {
      // Make the request using auth.fetch instead of makeRequest
      const response = await fetch(followUrl, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/x-www-form-urlencoded",
          "x-twitter-active-user": "yes",
          "x-twitter-auth-type": "OAuth2Session",
          "x-twitter-client-language": "en",
          "x-csrf-token": headers["x-csrf-token"] || "",
          Referer: `https://twitter.com/${username}`,
          Origin: "https://twitter.com",
          authority: "twitter.com",
        },
        body: formData.toString(),
        credentials: "include",
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new TwitterError(
          response.status,
          responseText || "Failed to follow user"
        );
      }

      return { data: undefined };
    } catch (error) {
      console.error("Error following user:", {
        error,
        userId,
        username,
      });

      if (error instanceof TwitterError) {
        throw error;
      }

      throw new TwitterError(
        (error as any).response?.status || 500,
        (error as any).message || "Failed to follow user"
      );
    }
  }

  private parseTweetResponse(response: any): RequestResponse<Tweet> {
    // Find tweet in the new response structure
    const tweetResult =
      response.data?.tweet_result?.result ||
      response.data?.create_tweet?.tweet_results?.result ||
      response.data?.createTweet?.tweet_results?.result ||
      response.data?.threaded_conversation_with_injections_v2?.instructions?.[0]
        ?.entries?.[0]?.content?.itemContent?.tweet_results?.result;

    if (!tweetResult) {
      console.log("Tweet result not found in response structure");
      console.log("Response data paths:", Object.keys(response.data || {}));
      console.log("Full response:", JSON.stringify(response, null, 2));
      throw new TwitterError(404, "Tweet not found");
    }

    const legacy = tweetResult.legacy || tweetResult.tweet?.legacy || {};
    const core = tweetResult.core || tweetResult.tweet?.core || {};
    const userLegacy = core?.user_results?.result?.legacy || {};

    const tweet: Tweet = {
      id: tweetResult.rest_id || legacy.id_str,
      text:
        tweetResult.note_tweet?.note_tweet_results?.result?.text ||
        legacy.full_text ||
        tweetResult.text ||
        "",
      authorId: core?.user_results?.result?.rest_id || legacy.user_id_str,
      authorUsername: userLegacy.screen_name,
      createdAt: legacy.created_at ? new Date(legacy.created_at) : undefined,
      conversationId: legacy.conversation_id_str,
      metrics: {
        likes: legacy.favorite_count || 0,
        retweets: legacy.retweet_count || 0,
        replies: legacy.reply_count || 0,
        views: parseInt(
          tweetResult.views?.count || legacy.ext_views?.count || "0"
        ),
        bookmarkCount: legacy.bookmark_count,
      },
      isQuoted: !!legacy.quoted_status_id_str,
      isReply: !!legacy.in_reply_to_status_id_str,
      isRetweet: !!legacy.retweeted_status_id_str,
      isPin: false,
      isSelfThread: this.checkIsSelfThread(legacy),
      sensitiveContent: this.checkSensitiveContent(legacy),
    };

    // Handle media
    const media = this.parseMedia(legacy.extended_entities?.media || []);
    if (media.photos.length || media.videos.length) {
      tweet.media = media;
    }

    // Handle polls
    if (tweetResult.card?.poll) {
      tweet.poll = this.parsePoll(tweetResult.card.poll);
    }

    // Handle quoted and retweeted content
    if (tweetResult.quoted_status_result?.result) {
      tweet.quotedTweet = this.parseTweetResponse({
        data: {
          tweet_result: { result: tweetResult.quoted_status_result.result },
        },
      }).data;
    }

    if (tweetResult.retweeted_status_result?.result) {
      tweet.retweetedTweet = this.parseTweetResponse({
        data: {
          tweet_result: { result: tweetResult.retweeted_status_result.result },
        },
      }).data;
    }

    return { data: tweet };
  }

  private parseProfileResponse(response: any): RequestResponse<Profile> {
    const user = response.data?.user?.result;
    if (!user) {
      throw new TwitterError(404, "User not found");
    }

    const legacy = user.legacy || {};

    const profile: Profile = {
      id: user.rest_id,
      username: legacy.screen_name,
      name: legacy.name,
      bio: legacy.description,
      metrics: {
        followers: legacy.followers_count,
        following: legacy.friends_count,
        tweets: legacy.statuses_count,
      },
      isPrivate: legacy.protected,
      isVerified: legacy.verified,
      isBlueVerified: user.is_blue_verified,
      avatar: legacy.profile_image_url_https?.replace("_normal", ""),
      banner: legacy.profile_banner_url,
      location: legacy.location,
      website: legacy.entities?.url?.urls?.[0]?.expanded_url,
      joined: legacy.created_at ? new Date(legacy.created_at) : undefined,
    };

    return { data: profile };
  }

  private parseSearchResponse(response: any): RequestResponse<Tweet[]> {
    const instructions =
      response.data?.search_by_raw_query?.search_timeline?.timeline
        ?.instructions || [];

    const tweets: Tweet[] = [];
    let nextCursor: string | undefined;

    for (const instruction of instructions) {
      if (instruction.type === "TimelineAddEntries") {
        for (const entry of instruction.entries || []) {
          if (entry.content?.itemContent?.tweet_results?.result) {
            const tweet = this.parseTweetResponse({
              data: {
                tweet_result: {
                  result: entry.content.itemContent.tweet_results.result,
                },
              },
            }).data;
            tweets.push(tweet);
          } else if (entry.content?.cursorType === "Bottom") {
            nextCursor = entry.content.value;
          }
        }
      }
    }

    return {
      data: tweets,
      meta: { nextCursor },
    };
  }

  private parseMedia(mediaItems: any[]): {
    photos: Array<{ id: string; url: string; altText?: string }>;
    videos: Array<{ id: string; url: string; preview: string }>;
  } {
    const media: {
      photos: Array<{ id: string; url: string; altText?: string }>;
      videos: Array<{ id: string; url: string; preview: string }>;
    } = {
      photos: [],
      videos: [],
    };

    for (const item of mediaItems) {
      if (item.type === "photo") {
        media.photos.push({
          id: item.id_str,
          url: item.media_url_https,
          altText: item.ext_alt_text,
        });
      } else if (item.type === "video" || item.type === "animated_gif") {
        const variant = item.video_info?.variants
          ?.filter((v: any) => v.content_type === "video/mp4")
          ?.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];

        if (variant) {
          media.videos.push({
            id: item.id_str,
            url: variant.url,
            preview: item.media_url_https,
          });
        }
      }
    }

    return media;
  }

  private parsePoll(pollData: any): Poll {
    return {
      id: pollData.id,
      options: pollData.choices.map((choice: any) => ({
        position: choice.position,
        label: choice.label,
        votes: choice.votes,
      })),
      end_datetime: pollData.end_datetime,
      duration_minutes: pollData.duration_minutes,
      voting_status: pollData.voting_status,
    };
  }

  private checkIsSelfThread(legacy: any): boolean {
    return (
      legacy.in_reply_to_user_id_str === legacy.user_id_str &&
      legacy.in_reply_to_status_id_str !== undefined
    );
  }

  private checkSensitiveContent(legacy: any): boolean {
    return (
      !!legacy.possibly_sensitive ||
      legacy.extended_entities?.media?.some(
        (m: any) => !!m.ext_sensitive_media_warning
      )
    );
  }

  async createPoll(options: {
    text: string;
    choices: string[];
    duration_minutes: number;
  }): Promise<RequestResponse<string>> {
    const pollUrl = "https://caps.x.com/v2/cards/create.json";
    const headers = await this.headers();

    // Create the card_data object
    const cardData = {
      card_data: {
        "twitter:card": "poll2choice_text_only",
        "twitter:api:api:endpoint": "1",
        "twitter:long:duration_minutes": options.duration_minutes,
        "twitter:string:choice1_label": options.choices[0],
        "twitter:string:choice2_label": options.choices[1],
      },
    };

    try {
      const response = await fetch(pollUrl, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/x-www-form-urlencoded",
          "x-twitter-active-user": "yes",
          "x-twitter-auth-type": "OAuth2Session",
          "x-twitter-client-language": "en",
          "x-csrf-token": headers["x-csrf-token"] || "",
          Referer: "https://twitter.com/compose/tweet",
          Origin: "https://twitter.com",
        },
        // Convert to URL-encoded form data
        body: new URLSearchParams({
          card_data: JSON.stringify(cardData.card_data),
        }).toString(),
        credentials: "include",
      });

      console.log("Poll creation response status:", response.status);
      const responseText = await response.text();
      console.log("Poll creation response:", responseText);

      if (!response.ok) {
        throw new TwitterError(
          response.status,
          `Failed to create poll: ${responseText}`
        );
      }

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        throw new TwitterError(400, `Invalid JSON response: ${responseText}`);
      }

      if (!responseData.card_uri) {
        throw new TwitterError(400, "No card_uri in response");
      }

      return { data: responseData.card_uri };
    } catch (error) {
      console.error("Error creating poll:", error);
      if (error instanceof TwitterError) {
        throw error;
      }
      throw new TwitterError(
        (error as any).response?.status || 500,
        (error as any).message || "Failed to create poll"
      );
    }
  }
}
